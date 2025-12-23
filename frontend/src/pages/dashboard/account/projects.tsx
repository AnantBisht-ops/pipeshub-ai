import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Paper,
  Alert,
  Skeleton,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Archive as ArchiveIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  ChatBubble as ChatIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from 'src/contexts/ProjectContext';
import { useOrganizationContext } from 'src/context/OrganizationContext';
import { CreateProjectDialog } from 'src/components/project-selector/CreateProjectDialog';

interface ProjectCardProps {
  project: any;
  onNavigate: (path: string) => void;
  onSwitch: (projectId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onNavigate, onSwitch }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [starred, setStarred] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStarToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    setStarred(!starred);
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
      onClick={() => onSwitch(project._id)}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <FolderIcon />
          </Avatar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={handleStarToggle}>
              {starred ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom noWrap>
          {project.name}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            height: 40,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {project.description || 'No description provided'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {project.settings?.isPublic ? (
            <Chip
              size="small"
              icon={<PublicIcon />}
              label="Public"
              color="success"
              variant="outlined"
            />
          ) : (
            <Chip
              size="small"
              icon={<LockIcon />}
              label="Private"
              color="default"
              variant="outlined"
            />
          )}
          {project.isArchived && (
            <Chip
              size="small"
              icon={<ArchiveIcon />}
              label="Archived"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>

        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DescriptionIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {project.metadata?.documentCount || 0} docs
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ChatIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {project.metadata?.conversationCount || 0} chats
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PeopleIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {project.members?.length || 0} members
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {new Date(project.metadata?.lastActivityAt || project.updatedAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          size="small"
          fullWidth
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/account/projects/${project._id}/settings`);
          }}
        >
          Settings
        </Button>
      </CardActions>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onNavigate(`/account/projects/${project._id}/settings`);
          }}
        >
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onNavigate(`/account/projects/${project._id}/members`);
          }}
        >
          <PeopleIcon fontSize="small" sx={{ mr: 1 }} />
          Members
        </MenuItem>
        {!project.isArchived && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              // Handle archive
            }}
          >
            <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
            Archive
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, isLoading, switchProject } = useProjectContext();
  const { currentOrg } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchiveFilter = showArchived ? true : !project.isArchived;
    return matchesSearch && matchesArchiveFilter;
  });

  const handleProjectSwitch = (projectId: string) => {
    switchProject(projectId);
    navigate('/');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Projects
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">
            Projects
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Project
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Manage all your projects in {currentOrg?.name}
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant={showArchived ? 'contained' : 'outlined'}
                size="small"
                startIcon={<ArchiveIcon />}
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? 'Hide' : 'Show'} Archived
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {filteredProjects.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <FolderIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No projects found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm
              ? 'Try adjusting your search criteria'
              : 'Get started by creating your first project'}
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Project
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredProjects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project._id}>
              <ProjectCard
                project={project}
                onNavigate={navigate}
                onSwitch={handleProjectSwitch}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateProjectDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Container>
  );
}