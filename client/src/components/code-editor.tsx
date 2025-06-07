import { useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
}

export function CodeEditor({ value, onChange, language }: CodeEditorProps) {
  const [isEditorReady, setIsEditorReady] = useState(false);
  const { toast } = useToast();

  const handleEditorDidMount = (editor: any) => {
    setIsEditorReady(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onChange(content);
        toast({
          title: "File Uploaded",
          description: `${file.name} has been loaded successfully`,
        });
      };
      reader.readAsText(file);
    }
    event.target.value = "";
  };

  const handleClear = () => {
    onChange("");
    toast({
      title: "Editor Cleared",
      description: "Code editor has been cleared",
    });
  };

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex items-center space-x-2">
        <label htmlFor="file-upload">
          <Button
            variant="secondary"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600"
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </span>
          </Button>
        </label>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept=".py,.js,.java,.cpp,.go,.c,.cs,.rb,.php,.ts,.jsx,.tsx"
          onChange={handleFileUpload}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClear}
          className="bg-slate-700 hover:bg-slate-600"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
      
      <div className="h-96 bg-slate-900 rounded-b-lg overflow-hidden">
        <Suspense 
          fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="ml-2 text-slate-400">Loading editor...</span>
            </div>
          }
        >
          <MonacoEditor
            height="100%"
            language={language}
            value={value}
            onChange={(val) => onChange(val || "")}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineNumbers: "on",
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              minimap: { enabled: false },
              wordWrap: "on",
              folding: true,
              lineDecorationsWidth: 10,
              lineNumbersMinChars: 3,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
