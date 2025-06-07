import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CodeEditor } from "@/components/code-editor";
import { AnalysisResults } from "@/components/analysis-results";
import { Brain, Code, Settings, HelpCircle, Loader2 } from "lucide-react";
import type { AnalysisResult } from "@shared/schema";

export default function Analyzer() {
  const [code, setCode] = useState(`// Example: 
    public class HelloWorld {
      public static void main(String[] args) {
        System.out.println("Hello, Welcome to AI Code Analyzer - By Lohith");
        System.out.println("Here you can able to upload the code files.");
      }
    }
`);
  
  const [language, setLanguage] = useState("java");
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzeCodeMutation = useMutation({
    mutationFn: async ({ code, language }: { code: string; language: string }) => {
      const response = await apiRequest("POST", "/api/analyze", { code, language });
      return response.json() as Promise<AnalysisResult>;
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: "Analysis Complete",
        description: "Code complexity has been analyzed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/test-connection", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.connected ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.connected ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!code.trim()) {
      toast({
        title: "No Code Provided",
        description: "Please enter some code to analyze",
        variant: "destructive",
      });
      return;
    }
    analyzeCodeMutation.mutate({ code, language });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-50 pt-8">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-slate-800 border-slate-700 border-b shadow-md z-50 mb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Code className="h-6 w-6 text-blue-400" />
                <h1 className="text-xl font-semibold">AI Code Analyzer</h1>
              </div>
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                Powered by Gemini
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="sm">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-5 ">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Code Input Section */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Code Input</CardTitle>
                  <div className="flex items-center space-x-2">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={language}
                />
                <div className="p-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                      {code.split('\n').length} lines • {code.length} characters
                    </div>
                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzeCodeMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {analyzeCodeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-4 w-4" />
                          Analyze Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Examples */}
            <Card className="mt-6 bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-400">Quick Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      name: "Fibonacci (Recursive)",
                      complexity: "Time: O(2^n), Space: O(n)",
                      code: `def fibonacci(n):
    """Calculate the nth Fibonacci number recursively."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Test the function
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`
                    },
                    {
                      name: "Bubble Sort",
                      complexity: "Time: O(n²), Space: O(1)",
                      code: `def bubble_sort(arr):
    """Sort array using bubble sort algorithm."""
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

# Test the function
numbers = [64, 34, 25, 12, 22, 11, 90]
sorted_numbers = bubble_sort(numbers.copy())
print(f"Sorted array: {sorted_numbers}")`
                    },
                    {
                      name: "Binary Search",
                      complexity: "Time: O(log n), Space: O(1)",
                      code: `def binary_search(arr, target):
    """Find target in sorted array using binary search."""
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1

# Test the function
numbers = [1, 3, 5, 7, 9, 11, 13, 15]
result = binary_search(numbers, 7)
print(f"Found at index: {result}")`
                    },
                    {
                      name: "Merge Sort",
                      complexity: "Time: O(n log n), Space: O(n)",
                      code: `def merge_sort(arr):
    """Sort array using merge sort algorithm."""
    if len(arr) <= 1:
        return arr
    
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    return merge(left, right)

def merge(left, right):
    """Merge two sorted arrays."""
    result = []
    i = j = 0
    
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    
    result.extend(left[i:])
    result.extend(right[j:])
    return result

# Test the function
numbers = [64, 34, 25, 12, 22, 11, 90]
sorted_numbers = merge_sort(numbers)
print(f"Sorted array: {sorted_numbers}")`
                    }
                  ].map((example) => (
                    <Button
                      key={example.name}
                      variant="outline"
                      className="h-auto p-3 text-left justify-start bg-slate-700 border-slate-600 hover:bg-slate-600"
                      onClick={() => setCode(example.code)}
                    >
                      <div>
                        <div className="text-sm font-medium text-blue-400">{example.name}</div>
                        <div className="text-xs text-slate-400 mt-1">{example.complexity}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Results */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <AnalysisResults
                results={results}
                isLoading={analyzeCodeMutation.isPending}
                error={analyzeCodeMutation.error}
              />
            </div>
          </div>
        </div>




      </main>
      <footer className="bg-slate-800 border-t border-slate-700 rounded-lg m-7 ">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center text-sm text-slate-400">
          <span>© 2025 AI Code Analyzer</span>
          <span>Made with ❤️ by Lohith</span>
        </div>
      </footer>
    </div>
  );
}
