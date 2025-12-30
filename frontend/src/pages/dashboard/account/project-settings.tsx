import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Stack
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Archive as ArchiveIcon,
  People as PeopleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectContext } from 'src/contexts/ProjectContext';
import { useOrganizationContext } from 'src/context/OrganizationContext';
import axios from 'src/utils/axios';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProjectSettingsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { projects, updateProject, deleteProject } = useProjectContext();
  const { currentOrg } = useOrganizationContext();

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentProject = projects.find(p => p._id === projectId);

  const [projectData, setProjectData] = useState({
    name: currentProject?.name || '',
    description: currentProject?.description || '',
    slug: currentProject?.slug || '',
    settings: {
      isPublic: currentProject?.settings?.isPublic || false,
      allowGuestAccess: currentProject?.settings?.allowGuestAccess || false,
      defaultPermissions: currentProject?.settings?.defaultPermissions || 'read'
    }
  });

  const [members, setMembers] = useState<any[]>([]);
  const [addMemberDialog, setAddMemberDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState(false);

  useEffect(() => {
    if (currentProject) {
      setProjectData({
        name: currentProject.name,
        description: currentProject.description || '',
        slug: currentProject.slug,
        settings: currentProject.settings || {
          isPublic: false,
          allowGuestAccess: false,
          defaultPermissions: 'read'
        }
      });
      // Fetch members
      fetchProjectMembers();
    }
  }, [currentProject]);

  const fetchProjectMembers = async () => {
    try {
      const response = await axios.get(`/api/v1/projects/${projectId}/members`);
      setMembers(response.data.members || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleUpdateProject = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProject(projectId!, projectData);
      setSuccess('Project updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    setLoading(true);
    try {
      await deleteProject(projectId!);
      navigate('/account/projects');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete project');
      setLoading(false);
    }
  };

  const handleArchiveProject = async () => {
    setLoading(true);
    try {
      await axios.put(`/api/v1/projects/${projectId}/archive`, { isArchived: true });
      setSuccess('Project archived successfully');
      setArchiveDialog(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string, role: string) => {
    try {
      await axios.post(`/api/v1/projects/${projectId}/members`, {
        userIds: [userId],
        role
      });
      fetchProjectMembers();
      setAddMemberDialog(false);
      setSuccess('Member added successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    try {
      await axios.patch(`/api/v1/projects/${projectId}/members/${userId}`, {
        role: newRole
      });
      fetchProjectMembers();
      setSuccess('Member role updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await axios.delete(`/api/v1/projects/${projectId}/members/${userId}`);
      fetchProjectMembers();
      setSuccess('Member removed successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  if (!currentProject) {
    return (
      <Container>
        <Alert severity="error">Project not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Project Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your project settings, members, and permissions
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="General" icon={<InfoIcon />} iconPosition="start" />
          <Tab label="Members" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Security" icon={<SecurityIcon />} iconPosition="start" />
          <Tab label="Advanced" icon={<SettingsIcon />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Project Name"
                  value={projectData.name}
                  onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Project Slug"
                  value={projectData.slug}
                  onChange={(e) => setProjectData({ ...projectData, slug: e.target.value })}
                  margin="normal"
                  helperText="URL-friendly identifier"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description"
                  value={projectData.description}
                  onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Project Information
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText primary="Project ID" secondary={currentProject._id} />
                    <IconButton size="small" onClick={() => navigator.clipboard.writeText(currentProject._id)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Created"
                      secondary={new Date(currentProject.createdAt || '').toLocaleDateString()}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Documents"
                      secondary={currentProject.metadata?.documentCount || 0}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Conversations"
                      secondary={currentProject.metadata?.conversationCount || 0}
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleUpdateProject}
                  disabled={loading}
                >
                  Save Changes
                </Button>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Project Members</Typography>
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => setAddMemberDialog(true)}
              >
                Add Member
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Member</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member._id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar>{member.name?.[0] || member.email?.[0]}</Avatar>
                          {member.name || 'Unknown'}
                        </Box>
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member._id, e.target.value)}
                        >
                          <MenuItem value="viewer">Viewer</MenuItem>
                          <MenuItem value="editor">Editor</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveMember(member._id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>Privacy Settings</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={projectData.settings.isPublic}
                      onChange={(e) => setProjectData({
                        ...projectData,
                        settings: { ...projectData.settings, isPublic: e.target.checked }
                      })}
                    />
                  }
                  label="Make project public to organization"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={projectData.settings.allowGuestAccess}
                      onChange={(e) => setProjectData({
                        ...projectData,
                        settings: { ...projectData.settings, allowGuestAccess: e.target.checked }
                      })}
                      disabled={!projectData.settings.isPublic}
                    />
                  }
                  label="Allow guest access"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Default Permissions</InputLabel>
                  <Select
                    value={projectData.settings.defaultPermissions}
                    onChange={(e) => setProjectData({
                      ...projectData,
                      settings: { ...projectData.settings, defaultPermissions: e.target.value }
                    })}
                    label="Default Permissions"
                  >
                    <MenuItem value="read">Read Only</MenuItem>
                    <MenuItem value="write">Read & Write</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleUpdateProject}
                  disabled={loading}
                >
                  Save Security Settings
                </Button>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mb: 3 }}>
                  These actions cannot be undone. Please proceed with caution.
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ArchiveIcon />
                    Archive Project
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Archiving a project will make it read-only and hide it from active project lists.
                  </Typography>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={() => setArchiveDialog(true)}
                  >
                    Archive Project
                  </Button>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 3, borderColor: 'error.main' }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <WarningIcon />
                    Delete Project
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Permanently delete this project and all associated data. This action cannot be undone.
                  </Typography>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => setDeleteDialog(true)}
                  >
                    Delete Project
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </Paper>

      {/* Archive Dialog */}
      <Dialog open={archiveDialog} onClose={() => setArchiveDialog(false)}>
        <DialogTitle>Archive Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to archive this project? It will become read-only and hidden from active lists.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialog(false)}>Cancel</Button>
          <Button onClick={handleArchiveProject} color="warning" variant="contained">
            Archive
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to permanently delete this project and all its data?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}