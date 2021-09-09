#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const minimist_1 = __importDefault(require("minimist"));
const index_1 = require("./index");
const { workspace = "./", srcDir = "", onlyTypeScript, onlyTemplate, excludeDir = [], verbose, _: explicitTargetFiles = [], } = minimist_1.default(process.argv.slice(2), {
    boolean: ["onlyTypeScript", "onlyTemplate", "verbose"],
    default: {
        onlyTypeScript: true,
        onlyTemplate: false,
        verbose: false
    },
    alias: {
        onlyTypeScript: ["ts", "typescript", "Typescript", "onlyTypescript", "onlyTs", "only-ts", "only-typescript"],
        onlyTemplate: ["template", "Template", "only-template"],
        verbose: ["v"],
    }
});
const cwd = process.cwd();
const _workspace = path.resolve(cwd, workspace);
index_1.check({
    workspace: _workspace,
    srcDir: path.resolve(_workspace, srcDir),
    onlyTemplate: Boolean(onlyTemplate),
    onlyTypeScript: Boolean(onlyTypeScript),
    excludeDirs: typeof excludeDir === "string" ? [excludeDir] : excludeDir,
    explicitTargetFiles,
    verbose,
});
