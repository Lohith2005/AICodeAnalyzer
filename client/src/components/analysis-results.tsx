import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, MemoryStick, FileText, Download, Copy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "@shared/schema";

interface AnalysisResultsProps {
  results: AnalysisResult | null;
  isLoading: boolean;
  error: Error | null;
}

export function AnalysisResults({ results, isLoading, error }: AnalysisResultsProps) {
  const { toast } = useToast();

  const handleExportJSON = () => {
    if (!results) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'code-analysis-results.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Results Exported",
      description: "Analysis results have been downloaded as JSON",
    });
  };

  const handleCopyToClipboard = async () => {
    if (!results) return;
    
    const text = `Lines of Code: ${results.linesOfCode}
Time Complexity: ${results.timeComplexity}
Space Complexity: ${results.spaceComplexity}

${results.explanation || ''}`;
    
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to Clipboard",
        description: "Analysis results have been copied",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <span className="text-slate-300">Analyzing code...</span>
          </div>
          <div className="mt-4 text-center text-sm text-slate-400">
            AI is processing your code complexity
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="text-sm font-medium text-red-200">Analysis Failed</h3>
          </div>
          <p className="text-sm text-red-300 mb-3">
            {error.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
          >
            Try Again →
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              Enter your code and click "Analyze Code" to see complexity analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lines of Code Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Lines of Code</h3>
            <FileText className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">{results.linesOfCode}</div>
          <div className="text-xs text-slate-400 mt-1">Non-empty, non-comment lines</div>
        </CardContent>
      </Card>

      {/* Time Complexity Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Time Complexity</h3>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{results.timeComplexity}</div>
          <div className="text-xs text-slate-400 mt-1">Estimated algorithmic complexity</div>
        </CardContent>
      </Card>

      {/* Space Complexity Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Space Complexity</h3>
            <MemoryStick className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">{results.spaceComplexity}</div>
          <div className="text-xs text-slate-400 mt-1">Estimated memory usage</div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      {results.explanation && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">Analysis Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-200 whitespace-pre-wrap">
              {results.explanation}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-400">Export Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            className="w-full justify-center bg-slate-700 border-slate-600 hover:bg-slate-600"
          >
            <Download className="h-4 w-4 mr-2" />
            Download as JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            className="w-full justify-center bg-slate-700 border-slate-600 hover:bg-slate-600"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-400">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Analysis Model</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Gemini 1.5 Flash</option>
                <option>Gemini Pro</option>
              </select>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">API Status</span>
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                Connected
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
