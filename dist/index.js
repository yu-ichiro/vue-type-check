"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
const path = __importStar(require("path"));
const vscode_languageserver_1 = require("vscode-languageserver");
const interpolationMode_1 = require("vue-language-server/dist/modes/template/interpolationMode");
const javascript_1 = require("vue-language-server/dist/modes/script/javascript");
const serviceHost_1 = require("vue-language-server/dist/services/typescriptService/serviceHost");
const languageModelCache_1 = require("vue-language-server/dist/embeddedSupport/languageModelCache");
const embeddedSupport_1 = require("vue-language-server/dist/embeddedSupport/embeddedSupport");
const typescript_1 = __importDefault(require("typescript"));
const progress_1 = __importDefault(require("progress"));
const print_1 = require("./print");
const file_util_1 = require("./file-util");
const glob_1 = require("glob");
const chalk_1 = __importDefault(require("chalk"));
let validLanguages = ["vue"];
function check(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { workspace, onlyTemplate, onlyTypeScript, excludeDirs, srcDir, explicitTargetFiles, verbose } = options;
        if (onlyTypeScript) {
            validLanguages = ["ts", "tsx", "vue"];
        }
        const docs = yield traverse(srcDir, onlyTypeScript, excludeDirs, explicitTargetFiles);
        yield getDiagnostics({ docs, workspace, onlyTemplate, verbose });
    });
}
exports.check = check;
function traverse(root, onlyTypeScript, excludeDirs, explicitTargetFiles) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetFiles = explicitTargetFiles.length > 0 ? explicitTargetFiles.map((file) => path.resolve(file)) : glob_1.glob.sync(path.join(root, `**/*.{${validLanguages.join(",")}}`), {
            ignore: ["node_modules", ...excludeDirs].map((ignore) => path.join(root, ignore) + "/**")
        });
        let files = yield Promise.all(targetFiles.map((absFilePath) => __awaiter(this, void 0, void 0, function* () {
            const src = yield file_util_1.readFile(absFilePath);
            return {
                absFilePath,
                fileExt: file_util_1.extractTargetFileExtension(absFilePath),
                src,
            };
        })));
        if (onlyTypeScript) {
            files = files.filter(({ src, fileExt }) => {
                if (fileExt !== "vue" || !hasScriptTag(src)) {
                    return true;
                }
                return isTs(src) || isImportOtherTs(src);
            });
        }
        return files.map(({ absFilePath, src, fileExt }) => vscode_languageserver_1.TextDocument.create(`file://${absFilePath}`, fileExt, 0, src));
    });
}
function getDiagnostics({ docs, workspace, onlyTemplate, verbose }) {
    return __awaiter(this, void 0, void 0, function* () {
        const documentRegions = languageModelCache_1.getLanguageModelCache(10, 60, (document) => embeddedSupport_1.getVueDocumentRegions(document));
        const scriptRegionDocuments = languageModelCache_1.getLanguageModelCache(10, 60, (document) => {
            const vueDocument = documentRegions.refreshAndGet(document);
            return vueDocument.getSingleTypeDocument("script");
        });
        let hasError = false;
        try {
            const serviceHost = serviceHost_1.getServiceHost(typescript_1.default, workspace, scriptRegionDocuments);
            const vueMode = new interpolationMode_1.VueInterpolationMode(typescript_1.default, serviceHost);
            const scriptMode = yield javascript_1.getJavascriptMode(serviceHost, scriptRegionDocuments, workspace);
            const bar = new progress_1.default("[:bar] :current/:total :file", {
                total: docs.length,
                width: 20,
                clear: true,
            });
            for (const doc of docs) {
                bar.render({ file: doc.uri });
                const vueTplResults = vueMode.doValidation(doc);
                let scriptResults = [];
                if (!onlyTemplate && scriptMode.doValidation) {
                    scriptResults = scriptMode.doValidation(doc);
                }
                const results = vueTplResults.concat(scriptResults);
                if (results.length) {
                    hasError = true;
                    bar.terminate();
                    if (verbose)
                        console.log(`${doc.uri} ... ${chalk_1.default.red(`${results.length} error(s)`)}`);
                    for (const result of results) {
                        const total = doc.lineCount;
                        const lines = print_1.getLines({
                            start: result.range.start.line,
                            end: result.range.end.line,
                            total,
                        });
                        print_1.printError(`Error in ${doc.uri}:${result.range.start.line + 1}:${result.range.start.character + 1}`);
                        print_1.printMessage(`${result.range.start.line + 1}:${result.range.start.character + 1} ${result.message}`);
                        for (const line of lines) {
                            const code = doc
                                .getText({
                                start: { line, character: 0 },
                                end: { line, character: Infinity },
                            })
                                .replace(/\n$/, "");
                            const isError = line === result.range.start.line;
                            print_1.printLog(print_1.formatLine({ number: line + 1, code, isError }));
                            if (isError) {
                                print_1.printLog(print_1.formatCursor(result.range));
                            }
                        }
                    }
                }
                else if (verbose) {
                    bar.terminate();
                    console.log(`${doc.uri} ... ${chalk_1.default.green("no errors")}`);
                }
                bar.tick();
            }
        }
        catch (error) {
            hasError = true;
            console.error(error);
        }
        finally {
            if (!hasError)
                console.log(chalk_1.default.green("No type errors found."));
            documentRegions.dispose();
            scriptRegionDocuments.dispose();
            process.exit(hasError ? 1 : 0);
        }
    });
}
function hasScriptTag(src) {
    return /.*\<script.*\>/.test(src);
}
function isTs(src) {
    return /.*\<script.*lang="tsx?".*\>/.test(src);
}
function isImportOtherTs(src) {
    return /.*\<script.*src=".*".*\>/.test(src);
}
