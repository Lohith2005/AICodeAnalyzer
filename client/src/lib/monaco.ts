// Monaco Editor utilities and configuration

export const SUPPORTED_LANGUAGES = {
  python: {
    name: "Python",
    extensions: [".py"],
    monacoId: "python"
  },
  javascript: {
    name: "JavaScript",
    extensions: [".js", ".jsx"],
    monacoId: "javascript"
  },
  typescript: {
    name: "TypeScript",
    extensions: [".ts", ".tsx"],
    monacoId: "typescript"
  },
  java: {
    name: "Java",
    extensions: [".java"],
    monacoId: "java"
  },
  cpp: {
    name: "C++",
    extensions: [".cpp", ".cc", ".cxx"],
    monacoId: "cpp"
  },
  c: {
    name: "C",
    extensions: [".c"],
    monacoId: "c"
  },
  csharp: {
    name: "C#",
    extensions: [".cs"],
    monacoId: "csharp"
  },
  go: {
    name: "Go",
    extensions: [".go"],
    monacoId: "go"
  },
  rust: {
    name: "Rust",
    extensions: [".rs"],
    monacoId: "rust"
  },
  php: {
    name: "PHP",
    extensions: [".php"],
    monacoId: "php"
  },
  ruby: {
    name: "Ruby",
    extensions: [".rb"],
    monacoId: "ruby"
  }
};

export const DEFAULT_EDITOR_OPTIONS = {
  theme: "vs-dark",
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
  lineNumbers: "on" as const,
  roundedSelection: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: "on" as const,
  folding: true,
  lineDecorationsWidth: 10,
  lineNumbersMinChars: 3,
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8
  }
};

export function detectLanguageFromExtension(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  for (const [key, config] of Object.entries(SUPPORTED_LANGUAGES)) {
    if (config.extensions.includes(ext)) {
      return key;
    }
  }
  
  return 'javascript'; // default fallback
}

export function getMonacoLanguageId(language: string): string {
  return SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES]?.monacoId || 'javascript';
}
