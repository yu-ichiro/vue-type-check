import * as path from "path";
import { TextDocument, Diagnostic } from "vscode-languageserver";
import { VueInterpolationMode } from "vue-language-server/dist/modes/template/interpolationMode";
import { getJavascriptMode } from "vue-language-server/dist/modes/script/javascript";
import { getServiceHost } from "vue-language-server/dist/services/typescriptService/serviceHost";
import { getLanguageModelCache } from "vue-language-server/dist/embeddedSupport/languageModelCache";
import { getVueDocumentRegions } from "vue-language-server/dist/embeddedSupport/embeddedSupport";
import tsModule from "typescript";
import ProgressBar from "progress";
import { formatCursor, formatLine, getLines, printError, printLog, printMessage, } from "./print";
import { extractTargetFileExtension, readFile } from "./file-util";
import { glob } from "glob";
import chalk from "chalk";

interface Options {
  workspace: string;
  srcDir: string;
  onlyTemplate: boolean;
  onlyTypeScript: boolean;
  excludeDirs: string[];
  explicitTargetFiles: string[];
  verbose: boolean;
}

interface Source {
  docs: TextDocument[];
  workspace: string;
  onlyTemplate: boolean;
  verbose: boolean;
}

let validLanguages = ["vue"];

export async function check(options: Options) {
  const { workspace, onlyTemplate, onlyTypeScript, excludeDirs, srcDir, explicitTargetFiles, verbose } = options;
  if (onlyTypeScript) {
    validLanguages = ["ts", "tsx", "vue"];
  }
  const docs = await traverse(srcDir, onlyTypeScript, excludeDirs, explicitTargetFiles);

  await getDiagnostics({ docs, workspace, onlyTemplate, verbose });
}

async function traverse(
  root: string,
  onlyTypeScript: boolean,
  excludeDirs: string[],
  explicitTargetFiles: string[]
): Promise<TextDocument[]> {
  const targetFiles = explicitTargetFiles.length > 0 ? explicitTargetFiles.map((file) => path.resolve(file)) : glob.sync(
    path.join(root, `**/*.{${validLanguages.join(",")}}`),
    {
      ignore: ["node_modules", ...excludeDirs].map((ignore) => path.join(root, ignore) + "/**")
    }
  )

  let files = await Promise.all(
    targetFiles.map(async (absFilePath) => {
      const src = await readFile(absFilePath);
      return {
        absFilePath,
        fileExt: extractTargetFileExtension(absFilePath) as string,
        src,
      };
    })
  );

  if (onlyTypeScript) {
    files = files.filter(({ src, fileExt }) => {
      if (fileExt !== "vue" || !hasScriptTag(src)) {
        return true;
      }
      return isTs(src) || isImportOtherTs(src);
    });
  }

  return files.map(({absFilePath, src, fileExt}) =>
    TextDocument.create(`file://${absFilePath}`, fileExt, 0, src)
  );
}

async function getDiagnostics({ docs, workspace, onlyTemplate, verbose }: Source) {
  const documentRegions = getLanguageModelCache(10, 60, (document) =>
    getVueDocumentRegions(document)
  );
  const scriptRegionDocuments = getLanguageModelCache(10, 60, (document) => {
    const vueDocument = documentRegions.refreshAndGet(document);
    return vueDocument.getSingleTypeDocument("script");
  });
  let hasError = false;
  try {
    const serviceHost = getServiceHost(
      tsModule,
      workspace,
      scriptRegionDocuments
    );
    const vueMode = new VueInterpolationMode(tsModule, serviceHost);
    const scriptMode = await getJavascriptMode(
      serviceHost,
      scriptRegionDocuments as any,
      workspace
    );
    const bar = new ProgressBar("[:bar] :current/:total :file", {
      total: docs.length,
      width: 20,
      clear: true,
    });
    for (const doc of docs) {
      bar.render({ file: doc.uri });
      const vueTplResults = vueMode.doValidation(doc);
      let scriptResults: Diagnostic[] = [];
      if (!onlyTemplate && scriptMode.doValidation) {
        scriptResults = scriptMode.doValidation(doc);
      }
      const results = vueTplResults.concat(scriptResults);
      if (results.length) {
        hasError = true;
        bar.terminate();
        if (verbose) console.log(`${doc.uri} ... ${chalk.red(`${results.length} error(s)`)}`)
        for (const result of results) {
          const total = doc.lineCount;
          const lines = getLines({
            start: result.range.start.line,
            end: result.range.end.line,
            total,
          });
          printError(`Error in ${doc.uri}:${result.range.start.line + 1}:${result.range.start.character + 1}`);
          printMessage(
            `${result.range.start.line + 1}:${result.range.start.character + 1} ${result.message}`
          );
          for (const line of lines) {
            const code = doc
              .getText({
                start: { line, character: 0 },
                end: { line, character: Infinity },
              })
              .replace(/\n$/, "");
            const isError = line === result.range.start.line;
            printLog(formatLine({ number: line + 1, code, isError }));
            if (isError) {
              printLog(formatCursor(result.range));
            }
          }
        }
      } else if (verbose) {
        bar.terminate();
        console.log(`${doc.uri} ... ${chalk.green("no errors")}`)
      }
      bar.tick();
    }
  } catch (error) {
    hasError = true;
    console.error(error);
  } finally {
    if (!hasError) console.log(chalk.green("No type errors found."))
    documentRegions.dispose();
    scriptRegionDocuments.dispose();
    process.exit(hasError ? 1 : 0);
  }
}

function hasScriptTag(src: string) {
  return /.*\<script.*\>/.test(src);
}

function isTs(src: string) {
  return /.*\<script.*lang="tsx?".*\>/.test(src);
}

function isImportOtherTs(src: string) {
  return /.*\<script.*src=".*".*\>/.test(src);
}
