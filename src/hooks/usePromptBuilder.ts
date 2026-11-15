import { useState, useCallback } from 'react';
import { estimateTokens, AVG_CHARS_PER_TOKEN } from '../utils/fileHelpers';
import { optimizeContent, detectBoundary, TextOptimizeOptions } from '../utils/textOptimizer';
import { fetchFileContent } from '../services/githubService';
import { trackEvent, logCrash } from '../services/telemetry';
import { Source, FileItem, PromptBatch, ProcessingOptionsState } from '../types';

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  });

  await Promise.all(workers);
  return results;
}

interface FetchedFile { file: FileItem; content: string }
type FetchOutcome = FetchedFile | { file: FileItem; error: string };

interface OptimizedFile { content: string; redactedSecretsCount: number }

const optimizeOnMainThread = (
  items: FetchedFile[],
  options: ProcessingOptionsState
): OptimizedFile[] => {
  return items.map(item =>
    optimizeContent(item.content, item.file.originalPath || item.file.path, options)
  );
};

async function optimizeBatch(
  items: FetchedFile[],
  options: ProcessingOptionsState,
  worker: Worker | null
): Promise<OptimizedFile[]> {
  if (!worker || items.length === 0) return optimizeOnMainThread(items, options);

  try {
    const results = await new Promise<OptimizedFile[]>((resolve, reject) => {
      const taskId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const handler = (evt: MessageEvent) => {
        if (!evt.data || evt.data.id !== taskId) return;
        worker.removeEventListener('message', handler);
        if (evt.data.type === 'BATCH_OPTIMIZE_CONTENT_SUCCESS') {
          resolve(evt.data.results as OptimizedFile[]);
        } else {
          reject(new Error(evt.data.error || 'Batch optimization failed'));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'BATCH_OPTIMIZE_CONTENT',
        id: taskId,
        items: items.map(item => ({
          content: item.content,
          filePath: item.file.originalPath || item.file.path,
        })),
        options,
      });
    });

    if (results.length !== items.length) return optimizeOnMainThread(items, options);
    return results;
  } catch (_) {
    return optimizeOnMainThread(items, options);
  }
}

export interface UsePromptBuilderParams {
  sources: Source[];
  selectedFiles: FileItem[];
  options: ProcessingOptionsState;
  githubToken: string;
  setLoading: (loading: boolean) => void;
  setLoadingMessage: (msg: string) => void;
  setErrorMessage?: (msg: string | null) => void;
  packWorkerRef: React.RefObject<Worker | null>;
}

export const usePromptBuilder = ({
  sources,
  selectedFiles,
  options,
  githubToken,
  setLoading,
  setLoadingMessage,
  setErrorMessage,
  packWorkerRef,
}: UsePromptBuilderParams) => {
  const [outputBatches, setOutputBatches] = useState<PromptBatch[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);

  const clearOutput = useCallback(() => {
    setOutputBatches([]);
    setActiveBatchIndex(0);
  }, []);

  const generateText = useCallback(async (): Promise<{ success: boolean; copied: boolean }> => {
    if (sources.length === 0 || selectedFiles.length === 0) return { success: false, copied: false };
    const startTime = performance.now();
    setLoading(true);
    setLoadingMessage('Fetching and optimizing codebase content...');
    if (setErrorMessage) setErrorMessage(null);

    trackEvent('generate_bundle_start', {
      sourceCount: sources.length,
      selectedCount: selectedFiles.length,
    });

    try {
      const allFiles: FileItem[] = [];
      for (const s of sources) {
        if (!s.selectedFiles || s.selectedFiles.length === 0) continue;
        allFiles.push(...s.selectedFiles.map((f) => {
          const origPath = f.originalPath || f.path;
          return {
            ...f,
            originalPath: origPath,
            path: sources.length > 1 ? `${s.name}/${origPath}` : origPath,
            sourceName: s.name,
            sourceType: s.type,
            sourceOwner: s.owner,
            sourceRepo: s.repo,
            sourceBranch: s.branch
          };
        }));
      }

      // Step 1: Fetch all file contents concurrently
      setLoadingMessage(`Fetching ${allFiles.length} file contents...`);
      const fetched = await mapConcurrent<FileItem, FetchOutcome>(allFiles, 16, async (file) => {
        try {
          let content = '';
          if (file.sourceType === 'github') {
            content = await fetchFileContent(
              file.sourceOwner || sources[0].owner!,
              file.sourceRepo || sources[0].repo!,
              file.sourceBranch || sources[0].branch || 'main',
              file.originalPath || file.path,
              githubToken,
              file.sourceId
            );
          } else {
            content = file.file ? await file.file.text() : await (await fetch(file.url!)).text();
          }
          return { file, content };
        } catch (err: unknown) {
          return { file, error: err instanceof Error ? err.message : String(err) };
        }
      });

      // Step 2: Optimise all fetched files in one worker roundtrip
      setLoadingMessage('Running code optimizers & secret scanners...');
      const readable = fetched.filter((outcome): outcome is FetchedFile => 'content' in outcome);
      const optimized = await optimizeBatch(readable, options, packWorkerRef.current);
      const optimizedByFile = new Map<FileItem, OptimizedFile>();
      readable.forEach((item, i) => optimizedByFile.set(item.file, optimized[i]));

      // Step 3: Build individual file block texts and compute exact post-optimization tokens
      interface ProcessedBlock {
        file: FileItem;
        text: string;
        tokenCount: number;
        redactedSecretsCount: number;
      }

      const addLineNumbers = (code: string): string => {
        const lines = code.split('\n');
        const padLen = String(lines.length).length;
        return lines.map((line, idx) => `${String(idx + 1).padStart(padLen, ' ')} | ${line}`).join('\n');
      };

      const processedBlocks: ProcessedBlock[] = fetched.map((outcome) => {
        const f = outcome.file;
        const ext = f.path.includes('.') ? f.path.slice(f.path.lastIndexOf('.') + 1).toLowerCase() : 'text';
        const isMarkdown = options.outputFormat === 'markdown';

        if ('error' in outcome) {
          const errText = isMarkdown
            ? `## File: ${f.path}\n<!-- Error reading file: ${outcome.error} -->`
            : `  <file path="${f.path}" status="error">\n    <!-- Error reading file: ${outcome.error} -->\n  </file>`;
          return {
            file: f,
            text: errText,
            tokenCount: estimateTokens(errText),
            redactedSecretsCount: 0,
          };
        }

        const optimizedFile = optimizedByFile.get(f);
        let opt = optimizedFile?.content ?? outcome.content;
        const redactedSecretsCount = optimizedFile?.redactedSecretsCount ?? 0;

        if (options.includeLineNumbers) {
          opt = addLineNumbers(opt);
        }

        let boundaryAttr = '';
        if (/\.(tsx|jsx|js|ts)$/i.test(f.path)) {
          const boundary = detectBoundary(outcome.content);
          if (boundary) {
            boundaryAttr = ` boundary="${boundary}"`;
          }
        }

        if (isMarkdown) {
          const mdText = `## File: ${f.path}\n\`\`\`${ext}\n${opt}\n\`\`\``;
          return {
            file: f,
            text: mdText,
            tokenCount: estimateTokens(mdText),
            redactedSecretsCount,
          };
        }

        const estTokens = estimateTokens(opt);
        const cdataEnd = ']]' + '>';
        const cdataEscape = ']]]]' + '><![CDATA[' + '>';
        const safeContent = opt.replaceAll(cdataEnd, cdataEscape);
        const xmlText = `  <file path="${f.path}"${boundaryAttr} language="${ext}" tokens="~${estTokens}">\n<![CDATA[\n${safeContent}\n${cdataEnd}\n  </file>`;

        return {
          file: f,
          text: xmlText,
          tokenCount: estimateTokens(xmlText),
          redactedSecretsCount,
        };
      });

      // Step 4: Build topology & ASCII tree helpers first to measure exact overhead
      const timestamp = new Date().toISOString();

      const buildTopologySummary = (files: FileItem[]): string => {
        const paths = files.map(f => f.path);
        const frameworks: string[] = [];
        const tags: string[] = [];

        const hasNext = paths.some(p => p.includes('next.config') || p.startsWith('app/') || p.includes('/app/'));
        const hasFlutter = paths.some(p => p.endsWith('pubspec.yaml') || p.endsWith('.dart'));
        const hasSupabase = paths.some(p => p.includes('supabase/'));
        const hasFirebase = paths.some(p => p.includes('firestore.rules') || p.includes('firebase.json'));
        const hasTurbo = paths.some(p =>
          p.includes('turbo.json') ||
          (p.includes('pnpm-workspace.yaml') && paths.some(fp => fp.startsWith('apps/') || fp.startsWith('packages/')))
        );

        if (hasTurbo) frameworks.push('Turborepo Monorepo');
        if (hasNext) frameworks.push('Next.js (App Router)');
        if (hasFlutter) frameworks.push('Flutter / Dart');
        if (hasSupabase) frameworks.push('Supabase BaaS');
        if (hasFirebase) frameworks.push('Firebase BaaS');

        if (hasNext) {
          const routes = paths
            .filter(p => /(?:^|\/)app\/.*page\.(tsx|jsx|js|ts)$/.test(p))
            .map(p => '      • /' + p.replace(/^.*?(?:^|\/)app\/?/, '').replace(/\/page\.[^.]+$/, '').replace(/\(.*?\)\/?/g, ''))
            .filter(Boolean);
          if (routes.length > 0) {
            tags.push(`    <route_map>\n${routes.join('\n')}\n    </route_map>`);
          }
        }

        if (hasFlutter) {
          const hasIos = paths.some(p => p.startsWith('ios/') || p.includes('/ios/'));
          const hasAndroid = paths.some(p => p.startsWith('android/') || p.includes('/android/'));
          const libFiles = paths.filter(p => p.startsWith('lib/') || p.includes('/lib/'));
          tags.push(`    <flutter_info dart_files="${libFiles.length}" ios_configured="${hasIos}" android_configured="${hasAndroid}" />`);
        }

        if (hasSupabase) {
          const migrationFiles = paths.filter(p => p.includes('supabase/migrations/'));
          tags.push(`    <supabase_info migrations="${migrationFiles.length}" rls_enabled="true" />`);
        }

        if (hasFirebase) {
          tags.push(`    <firebase_info security_rules_included="${paths.some(p => p.includes('.rules'))}" />`);
        }

        return `  <framework_topology detected="${frameworks.join(', ') || 'Standard'}" count="${files.length}">\n${tags.join('\n')}\n  </framework_topology>`;
      };

      const topologyXml = buildTopologySummary(allFiles);

      const buildAsciiDirectoryTree = (files: FileItem[]): string => {
        interface TreeNode {
          dirs: Map<string, TreeNode>;
          files: string[];
        }
        const root: TreeNode = { dirs: new Map(), files: [] };

        for (const f of files) {
          const parts = f.path.split('/');
          let curr = root;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!curr.dirs.has(part)) {
              curr.dirs.set(part, { dirs: new Map(), files: [] });
            }
            curr = curr.dirs.get(part)!;
          }
          curr.files.push(parts[parts.length - 1]);
        }

        const lines: string[] = [];
        const renderNode = (node: TreeNode, prefix: string) => {
          const dirEntries = Array.from(node.dirs.entries()).sort((a, b) => a[0].localeCompare(b[0]));
          const sortedFiles = [...node.files].sort((a, b) => a.localeCompare(b));
          const totalEntries = dirEntries.length + sortedFiles.length;
          let count = 0;

          for (const [dirName, childNode] of dirEntries) {
            count++;
            const isLast = count === totalEntries;
            const branch = isLast ? '└── ' : '├── ';
            lines.push(`${prefix}${branch}${dirName}/`);
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            renderNode(childNode, nextPrefix);
          }

          for (const fileName of sortedFiles) {
            count++;
            const isLast = count === totalEntries;
            const branch = isLast ? '└── ' : '├── ';
            lines.push(`${prefix}${branch}${fileName}`);
          }
        };

        renderNode(root, '');
        return lines.join('\n');
      };

      const asciiTree = buildAsciiDirectoryTree(allFiles);

      const treeManifest = processedBlocks
        .map(b => `    • ${b.file.path} (~${b.tokenCount.toLocaleString()} tokens)`)
        .join('\n');

      // Measure overhead of manifest & overview to avoid overshooting maxTokens
      const sampleHeader = `<codebase_context tool="repointxt" generated_at="${timestamp}" part="1" total_parts="1"><overview>${topologyXml}<selected_files_count>${allFiles.length}</selected_files_count><directory_structure>${asciiTree}</directory_structure><manifest>${treeManifest}</manifest></overview>`;
      const sampleFooter = `<instructions>${options.customInstructions || '- Reference exact file paths when analyzing code.'}</instructions></codebase_context>`;
      const overheadTokens = estimateTokens(sampleHeader + sampleFooter);

      // Step 5: Accurately chunk processed blocks based on maxContextTokens
      const maxTokens = options.maxContextTokens;
      const isNoLimit = !maxTokens || maxTokens <= 0;
      const maxPayloadTokens = isNoLimit
        ? Number.POSITIVE_INFINITY
        : Math.max(5000, maxTokens - overheadTokens - 500);

      const blockBatches: ProcessedBlock[][] = [[]];
      let currentBatchTokens = 0;

      for (const block of processedBlocks) {
        if (!isNoLimit && currentBatchTokens + block.tokenCount > maxPayloadTokens && blockBatches[blockBatches.length - 1].length > 0) {
          blockBatches.push([]);
          currentBatchTokens = 0;
        }
        blockBatches[blockBatches.length - 1].push(block);
        currentBatchTokens += block.tokenCount;
      }

      const totalParts = blockBatches.length;
      const generatedBatches: PromptBatch[] = [];

      for (let bIndex = 0; bIndex < totalParts; bIndex++) {
        const currentBlocks = blockBatches[bIndex];
        const isMultiPart = totalParts > 1;
        const parts: string[] = [];
        const isMarkdown = options.outputFormat === 'markdown';

        if (isMarkdown) {
          parts.push(`# Repository Context: ${sources.map(s => s.name).join(', ')}`);
          parts.push(`> Generated by repointxt (100% Client-Side) at ${timestamp}`);
          parts.push(`> Part ${bIndex + 1} of ${totalParts} | Selected files: ${allFiles.length}\n`);
          parts.push(`## File Manifest\n${treeManifest}\n`);

          if (isMultiPart) {
            const currentPaths = new Set(currentBlocks.map(b => b.file.path));
            const deferredFiles = allFiles
              .filter(f => !currentPaths.has(f.path))
              .slice(0, 15)
              .map(f => `- \`${f.path}\``)
              .join('\n');

            parts.push(`## Multi-Part Batch Notice`);
            parts.push(`CRITICAL: This is Part ${bIndex + 1} of a ${totalParts}-part codebase bundle.`);
            parts.push(`Deferred files sample:\n${deferredFiles}\n`);
          }
        } else {
          parts.push(
            `<codebase_context ` +
            `tool="repointxt by CorbitLabs (Corbit Technologies)" ` +
            `github="https://github.com/CorbitLabs/repointxt" ` +
            `generated_at="${timestamp}" ` +
            `part="${bIndex + 1}" ` +
            `total_parts="${totalParts}">`
          );
          parts.push(`  <overview>`);
          parts.push(topologyXml);
          parts.push(`    <selected_files_count>${allFiles.length}</selected_files_count>`);
          if (asciiTree) {
            parts.push(`    <directory_structure>\n${asciiTree}\n    </directory_structure>`);
          }
          parts.push(`    <manifest>\n${treeManifest}\n    </manifest>`);

          if (isMultiPart) {
            const currentPaths = new Set(currentBlocks.map(b => b.file.path));
            const deferredFiles = allFiles
              .filter(f => !currentPaths.has(f.path))
              .slice(0, 15)
              .map(f => `      <file>${f.path}</file>`)
              .join('\n');

            parts.push(`    <context_batch_metadata>`);
            parts.push(`      <current_part>${bIndex + 1}</current_part>`);
            parts.push(`      <total_parts>${totalParts}</total_parts>`);
            parts.push(`      <deferred_files_sample>\n${deferredFiles}\n      </deferred_files_sample>`);
            parts.push(`      <ai_instruction>`);
            parts.push(`        CRITICAL: This is Part ${bIndex + 1} of a ${totalParts}-part codebase bundle.`);
            parts.push(`        - Do NOT assume deferred or omitted files are missing from the project.`);
            parts.push(`        - Acknowledge receipt of Part ${bIndex + 1} and await subsequent parts before assuming missing dependencies.`);
            parts.push(`      </ai_instruction>`);
            parts.push(`    </context_batch_metadata>`);
          }
          parts.push(`  </overview>\n`);
        }

        const blockTexts = currentBlocks.map(b => b.text);
        const batchRedactedCount = currentBlocks.reduce((acc, b) => acc + b.redactedSecretsCount, 0);

        parts.push(blockTexts.join('\n\n'));

        if (isMarkdown) {
          parts.push(`\n## Instructions`);
          if (options.customInstructions?.trim()) {
            parts.push(options.customInstructions.trim());
          } else {
            parts.push(`- Reference exact file paths when analyzing or citing code.`);
            parts.push(`- Base all recommendations strictly on the implementation patterns provided above.`);
            parts.push(`- Avoid leaving placeholder comments like '// ... rest of code' when suggesting edits.`);
          }
        } else {
          parts.push(`\n  <instructions>`);
          if (options.customInstructions?.trim()) {
            parts.push(`    ${options.customInstructions.trim().replaceAll('\n', '\n    ')}`);
          } else {
            parts.push(`    - Reference exact file paths from <file path="..."> when analyzing or citing code.`);
            parts.push(`    - Base all recommendations strictly on the implementation patterns provided above.`);
            parts.push(`    - Avoid leaving placeholder comments like '// ... rest of code' when suggesting edits.`);
          }
          parts.push(`  </instructions>`);
          parts.push(`</codebase_context>`);
        }

        const batchText = parts.join('\n');
        generatedBatches.push({
          part: bIndex + 1,
          totalParts,
          text: batchText,
          tokenCount: estimateTokens(batchText),
          charCount: batchText.length,
          redactedSecretsCount: batchRedactedCount,
        });
      }

      const elapsedMs = Math.round(performance.now() - startTime);

      const batchesWithMetrics = generatedBatches.map(b => ({
        ...b,
        elapsedMs
      }));

      setOutputBatches(batchesWithMetrics);
      setActiveBatchIndex(0);

      const totalTokens = generatedBatches.reduce((acc, b) => acc + b.tokenCount, 0);
      trackEvent('generate_bundle_success', {
        batchCount: generatedBatches.length,
        totalTokens,
        fileCount: allFiles.length,
        elapsedMs
      });

      let copied = false;
      if (batchesWithMetrics.length > 0) {
        try {
          await navigator.clipboard.writeText(batchesWithMetrics[0].text);
          copied = true;
        } catch (_) {}
      }

      setTimeout(() => {
        document.getElementById('output-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      return { success: true, copied };
    } catch (e: any) {
      logCrash(e, false, { context: 'generateText' });
      const msg = e instanceof Error ? e.message : 'Failed to generate context bundles.';
      if (setErrorMessage) {
        setErrorMessage(msg);
      }
      return { success: false, copied: false };
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [sources, selectedFiles, options, githubToken, packWorkerRef, setLoading, setLoadingMessage, setErrorMessage]);

  return {
    outputBatches, setOutputBatches,
    activeBatchIndex, setActiveBatchIndex,
    clearOutput, generateText,
  };
};
