// src/lib/flags.ts

export interface GlobalFlags {
  quiet: boolean;
  ci: boolean;
  help: boolean;
  version: boolean;
  args: string[];
}

export interface UploadFlags {
  prefix?: string;
  compression: number;
  as?: string;
  fast: boolean;
  slow: boolean;
  paths: string[];
}

export interface ListFlags {
  json: boolean;
  prefix?: string;
}

export interface PruneFlags {
  olderThan?: number;
  keepLast?: number;
  minAge: string;
  dryRun: boolean;
  prefix: string;
}

export function parseGlobalFlags(args: string[]): GlobalFlags {
  const result: GlobalFlags = {
    args: [],
    ci: false,
    help: false,
    quiet: false,
    version: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--quiet' || arg === '-q') {
      result.quiet = true;
    } else if (arg === '--ci') {
      result.ci = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else {
      // Pass through everything else (including command-specific flags)
      result.args.push(arg);
    }
  }

  return result;
}

export function parseUploadFlags(args: string[]): UploadFlags {
  const result: UploadFlags = {
    compression: 6,
    fast: false,
    paths: [],
    slow: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--prefix' && args[i + 1]) {
      result.prefix = args[++i];
    } else if (arg === '--compression' && args[i + 1]) {
      result.compression = parseInt(args[++i], 10);
    } else if (arg === '--as' && args[i + 1]) {
      result.as = args[++i];
    } else if (arg === '--fast' || arg === '-f') {
      result.fast = true;
    } else if (arg === '--slow' || arg === '-s') {
      result.slow = true;
    } else if (!arg.startsWith('-')) {
      result.paths.push(arg);
    }
  }

  return result;
}

export function parseListFlags(args: string[]): ListFlags {
  const result: ListFlags = {
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      result.json = true;
    } else if (!arg.startsWith('-')) {
      result.prefix = arg;
    }
  }

  return result;
}

export function parsePruneFlags(args: string[]): PruneFlags {
  const result: PruneFlags = {
    dryRun: false,
    minAge: '1d',
    prefix: ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--older-than' && args[i + 1]) {
      result.olderThan = parseInt(args[++i], 10);
    } else if (arg === '--keep-last' && args[i + 1]) {
      result.keepLast = parseInt(args[++i], 10);
    } else if (arg === '--min-age' && args[i + 1]) {
      result.minAge = args[++i];
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (!arg.startsWith('-')) {
      result.prefix = arg;
    }
  }

  return result;
}
