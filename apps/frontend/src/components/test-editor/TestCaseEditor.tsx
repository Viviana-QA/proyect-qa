import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Code } from 'lucide-react';

interface TestCase {
  id: string;
  title: string;
  test_type: string;
  playwright_code: string;
}

interface TestCaseEditorProps {
  testCase: TestCase;
  onSave: (code: string) => void;
  onClose: () => void;
  isSaving?: boolean;
}

export function TestCaseEditor({
  testCase,
  onSave,
  onClose,
  isSaving = false,
}: TestCaseEditorProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState(testCase.playwright_code || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]/10">
              <Code className="h-4 w-4 text-[#7c3aed]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1e1b4b]">
                {t('generation.editTestCase')}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {testCase.title}
                </span>
                <Badge variant="info" className="text-[10px] uppercase">
                  {testCase.test_type}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
              {t('generation.cancel')}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9]"
              onClick={() => onSave(code)}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('generation.saveChanges')}
            </Button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            language="typescript"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}
