import { useState } from 'react';
import { useParams } from 'react-router';
import { useTestCases, useDeleteTestCase } from '@/hooks/use-test-cases';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Code2 } from 'lucide-react';
import type { TestType } from '@qa/shared-types';

const TEST_TYPES: TestType[] = [
  'e2e', 'regression', 'visual', 'accessibility',
  'performance', 'api', 'cross_browser', 'responsive',
];

export function TestCasesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const { data: testCases, isLoading } = useTestCases(projectId!, {
    test_type: typeFilter || undefined,
  });
  const deleteTestCase = useDeleteTestCase();

  const filtered = testCases?.filter(
    (tc) =>
      tc.title.toLowerCase().includes(search.toLowerCase()) ||
      tc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Cases</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Test Case
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search test cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Types</option>
          {TEST_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !filtered?.length ? (
        <div className="py-12 text-center">
          <Code2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No test cases found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tc) => (
            <Card key={tc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{tc.title}</p>
                    <Badge variant="outline">{tc.test_type}</Badge>
                    <Badge
                      variant={
                        tc.priority === 'critical'
                          ? 'destructive'
                          : tc.priority === 'high'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {tc.priority}
                    </Badge>
                    <Badge variant={tc.status === 'active' ? 'success' : 'secondary'}>
                      {tc.status}
                    </Badge>
                  </div>
                  {tc.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {tc.description}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1">
                    {tc.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Code2 className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm('Delete this test case?')) {
                        deleteTestCase.mutate(tc.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
