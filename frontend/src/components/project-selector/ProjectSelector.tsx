import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Chip,
  IconButton
} from '@mui/material';
import {
  Folder as FolderIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  ViewModule as ViewModuleIcon,
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useProjectContext } from '../../contexts/ProjectContext';
import { CreateProjectDialog } from './CreateProjectDialog';
import { useNavigate } from 'react-router-dom';

export const ProjectSelector: React.FC = () => {
  const {
    projects,
    currentProject,
    isAllProjects,
    isLoading,
    switchProject
  } = useProjectContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSwitch = (projectId: string | null) => {
    switchProject(projectId);
    handleClose();
  };

  const handleManageProjects = () => {
    handleClose();
    navigate('/account/projects');
  };

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleClick}
        startIcon={isAllProjects ? <ViewModuleIcon /> : <FolderIcon />}
        endIcon={<ExpandMoreIcon />}
        sx={{
          color: 'text.primary',
          textTransform: 'none',
          fontWeight: 500,
          px: 2,
          py: 1,
          borderRadius: 2,
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }}
      >
        {isAllProjects ? 'All Projects' : (currentProject?.name || 'Select Project')}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 320,
            mt: 1,
            borderRadius: 2
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            PROJECTS
          </Typography>
        </Box>

        {projects.map((project) => (
          <MenuItem
            key={project._id}
            onClick={() => handleSwitch(project._id)}
            selected={project._id === currentProject?._id && !isAllProjects}
          >
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{project.name}</span>
                  {project._id === currentProject?._id && !isAllProjects && (
                    <CheckIcon fontSize="small" color="primary" />
                  )}
                </Box>
              }
              secondary={
                <Typography variant="caption">
                  {project.metadata.conversationCount} conversations •
                  {project.metadata.documentCount} documents
                </Typography>
              }
            />
          </MenuItem>
        ))}

        <Divider sx={{ my: 1 }} />

        <MenuItem
          onClick={() => handleSwitch(null)}
          selected={isAllProjects}
        >
          <ListItemIcon>
            <ViewModuleIcon />
          </ListItemIcon>
          <ListItemText primary="All Projects" />
          {isAllProjects && <CheckIcon fontSize="small" color="primary" />}
        </MenuItem>

        <MenuItem onClick={() => setCreateDialogOpen(true)}>
          <ListItemIcon>
            <AddIcon />
          </ListItemIcon>
          <ListItemText primary="Create New Project" />
        </MenuItem>

        <MenuItem onClick={handleManageProjects}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Manage Projects" />
        </MenuItem>
      </Menu>

      <CreateProjectDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </>
  );
};