interface Options {
    workspace: string;
    srcDir: string;
    onlyTemplate: boolean;
    onlyTypeScript: boolean;
    excludeDirs: string[];
    explicitTargetFiles: string[];
    verbose: boolean;
}
export declare function check(options: Options): Promise<void>;
export {};
