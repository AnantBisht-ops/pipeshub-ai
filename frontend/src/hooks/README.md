# Data Hooks with Project Context

All data hooks now support multi-tenancy with automatic project and organization context filtering.

## Available Hooks

### `useConversations(options?)`
Manages conversations with automatic project/org filtering.

```typescript
import { useConversations } from 'src/hooks/use-conversations';

function ConversationList() {
  const {
    conversations,
    loading,
    error,
    total,
    hasMore,
    fetchConversations,
    createConversation,
    deleteConversation,
    archiveConversation,
    loadMore,
    refresh
  } = useConversations({
    limit: 20,
    shared: false,
    archived: false
  });

  // Conversations are automatically filtered by current project/org
  return (
    <div>
      {conversations.map(conv => (
        <ConversationItem key={conv._id} conversation={conv} />
      ))}
    </div>
  );
}
```

### `useDocuments(options?)`
Manages documents/files with automatic project/org filtering.

```typescript
import { useDocuments } from 'src/hooks/use-documents';

function DocumentList() {
  const {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    refresh
  } = useDocuments({
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const handleUpload = async (file: File) => {
    try {
      await uploadDocument(file, {
        tags: ['important'],
        description: 'Project documentation'
      });
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <DocumentGrid
      documents={documents}
      onUpload={handleUpload}
    />
  );
}
```

### `useAgents(options?)`
Manages AI agents with automatic project/org filtering.

```typescript
import { useAgents } from 'src/hooks/use-agents';

function AgentsList() {
  const {
    agents,
    loading,
    createAgent,
    updateAgent,
    deleteAgent,
    shareAgent
  } = useAgents({
    includeShared: true,
    includePublic: false
  });

  const handleCreateAgent = async () => {
    const newAgent = await createAgent({
      name: 'Customer Support Bot',
      description: 'Handles customer inquiries',
      systemPrompt: 'You are a helpful assistant...',
      model: 'gpt-4'
    });
  };

  return (
    <AgentGrid agents={agents} onCreate={handleCreateAgent} />
  );
}
```

### `useAgentConversations(agentKey, options?)`
Manages conversations for a specific agent.

```typescript
import { useAgentConversations } from 'src/hooks/use-agents';

function AgentChat({ agentKey }) {
  const {
    conversations,
    loading,
    createConversation,
    deleteConversation,
    archiveConversation
  } = useAgentConversations(agentKey, {
    limit: 10,
    archived: false
  });

  const startNewChat = async () => {
    const conversation = await createConversation('Hello!');
    // Navigate to conversation
  };

  return (
    <ChatInterface
      conversations={conversations}
      onNewChat={startNewChat}
    />
  );
}
```

## How It Works

1. **Automatic Context**: All hooks automatically read the current organization and project from context providers.

2. **Project Filtering**: When a specific project is selected, data is filtered to that project. When "All Projects" is selected, data from all projects in the organization is shown.

3. **Context Switching**: When the user switches projects or organizations, hooks automatically refetch data with the new context.

4. **Backward Compatibility**: Data without projectId (legacy data) is still accessible when in "All Projects" view.

## Migration Guide

### Old Pattern (without project context):
```typescript
// Before
const fetchConversations = async () => {
  const response = await axios.get('/api/v1/conversations', {
    params: { page: 1, limit: 20 }
  });
  return response.data;
};
```

### New Pattern (with hooks):
```typescript
// After
import { useConversations } from 'src/hooks/use-conversations';

function MyComponent() {
  const { conversations, loading, refresh } = useConversations();
  // Project/org context is handled automatically
}
```

## Best Practices

1. **Use hooks instead of direct API calls**: This ensures proper project/org scoping.

2. **Handle loading and error states**: All hooks provide loading and error states.

3. **Implement pagination**: Use `loadMore()` for infinite scrolling or pagination.

4. **Refresh on actions**: Call `refresh()` after bulk operations or when data might be stale.

5. **Type safety**: All hooks are fully typed with TypeScript.

## Testing

When testing components that use these hooks, mock the context providers:

```typescript
import { render } from '@testing-library/react';
import { OrganizationProvider } from 'src/context/OrganizationContext';
import { ProjectProvider } from 'src/contexts/ProjectContext';

const renderWithContext = (component) => {
  return render(
    <OrganizationProvider>
      <ProjectProvider>
        {component}
      </ProjectProvider>
    </OrganizationProvider>
  );
};
```