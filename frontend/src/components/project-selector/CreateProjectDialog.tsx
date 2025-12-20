import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  Create as CreateIcon,
  Link as LinkIcon,
  Description as DescriptionIcon,
  Public as PublicIcon
} from '@mui/icons-material';
import { useProjectContext } from '../../contexts/ProjectContext';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  open,
  onClose
}) => {
  const { createProject } = useProjectContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isPublic: false,
    allowGuestAccess: false
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({
      ...formData,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!formData.slug.trim()) {
      setError('Project slug is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProject({
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        settings: {
          isPublic: formData.isPublic,
          allowGuestAccess: formData.allowGuestAccess,
          defaultPermissions: 'read'
        }
      });

      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      isPublic: false,
      allowGuestAccess: false
    });
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CreateIcon />
        Create New Project
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Project Name"
            value={formData.name}
            onChange={handleNameChange}
            fullWidth
            required
            autoFocus
            placeholder="e.g., Marketing Campaign"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CreateIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            helperText="Choose a descriptive name for your project"
          />

          <TextField
            label="Project Slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            fullWidth
            required
            placeholder="e.g., marketing-campaign"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LinkIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            helperText="URL-friendly identifier (lowercase letters, numbers, and hyphens)"
          />

          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={3}
            placeholder="Brief description of the project's purpose..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ mt: 1 }}>
                  <DescriptionIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            helperText="Optional: Describe the project's goals and scope"
          />

          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Privacy Settings
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PublicIcon fontSize="small" />
                  <span>Make project public to organization</span>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.allowGuestAccess}
                  onChange={(e) => setFormData({ ...formData, allowGuestAccess: e.target.checked })}
                  disabled={!formData.isPublic}
                />
              }
              label="Allow guest access"
              sx={{ ml: 4 }}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.name || !formData.slug}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};