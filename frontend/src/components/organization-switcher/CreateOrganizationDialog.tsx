import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Stack,
  InputAdornment,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { useOrganizationContext } from 'src/context/OrganizationContext';

interface CreateOrganizationDialogProps {
  open: boolean;
  onClose: () => void;
}

interface OrganizationFormData {
  registeredName: string;
  shortName: string;
  contactEmail: string;
  accountType: 'individual' | 'business';
  adminFullName: string;
  phoneNumber?: string;
  domain?: string;
  permanentAddress?: {
    addressLine1: string;
    city: string;
    state: string;
    postCode: string;
    country: string;
  };
}

export const CreateOrganizationDialog: React.FC<CreateOrganizationDialogProps> = ({
  open,
  onClose,
}) => {
  const { createOrganization } = useOrganizationContext();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OrganizationFormData>({
    registeredName: '',
    shortName: '',
    contactEmail: '',
    accountType: 'individual',
    adminFullName: '',
    phoneNumber: '',
  });

  const steps = ['Organization Type', 'Organization Details', 'Review & Create'];

  const handleFieldChange = (field: keyof OrganizationFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateStep = (): boolean => {
    switch (activeStep) {
      case 0:
        if (!formData.accountType) {
          setError('Please select an organization type');
          return false;
        }
        break;
      case 1:
        if (!formData.registeredName) {
          setError('Organization name is required');
          return false;
        }
        if (!formData.contactEmail) {
          setError('Contact email is required');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
          setError('Please enter a valid email address');
          return false;
        }
        if (!formData.adminFullName) {
          setError('Admin name is required');
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    setError(null);

    try {
      // Generate domain from email if not provided
      const domain = formData.domain || formData.contactEmail.split('@')[1];

      const organizationData = {
        ...formData,
        domain,
        onBoardingStatus: 'notConfigured' as const,
        sendEmail: true, // Send welcome email
      };

      await createOrganization(organizationData);
      onClose();
      // The organization context will handle switching to the new org
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to create organization:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to create organization. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        registeredName: '',
        shortName: '',
        contactEmail: '',
        accountType: 'individual',
        adminFullName: '',
        phoneNumber: '',
      });
      setActiveStep(0);
      setError(null);
      onClose();
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Organization Type</FormLabel>
              <RadioGroup
                value={formData.accountType}
                onChange={(e) => handleFieldChange('accountType', e.target.value as 'individual' | 'business')}
              >
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    value="individual"
                    control={<Radio />}
                    label={
                      <Box sx={{ ml: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PersonIcon />
                          <Typography variant="subtitle1">Individual</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          For personal use or freelancers
                        </Typography>
                      </Box>
                    }
                    sx={{
                      border: 1,
                      borderColor: formData.accountType === 'individual' ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      p: 2,
                      mb: 2,
                      width: '100%',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                  />

                  <FormControlLabel
                    value="business"
                    control={<Radio />}
                    label={
                      <Box sx={{ ml: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <BusinessIcon />
                          <Typography variant="subtitle1">Business</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          For companies and teams
                        </Typography>
                      </Box>
                    }
                    sx={{
                      border: 1,
                      borderColor: formData.accountType === 'business' ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      p: 2,
                      width: '100%',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                  />
                </Box>
              </RadioGroup>
            </FormControl>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                {formData.accountType === 'business'
                  ? 'Business accounts support multiple projects and advanced features.'
                  : 'Individual accounts are perfect for personal use with essential features.'}
              </Typography>
            </Alert>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Stack spacing={3}>
              <TextField
                label="Organization Name"
                fullWidth
                required
                value={formData.registeredName}
                onChange={(e) => handleFieldChange('registeredName', e.target.value)}
                placeholder={
                  formData.accountType === 'business'
                    ? 'e.g., Acme Corporation'
                    : 'e.g., John Doe'
                }
                helperText="This is your organization's display name"
              />

              <TextField
                label="Short Name"
                fullWidth
                value={formData.shortName}
                onChange={(e) => handleFieldChange('shortName', e.target.value)}
                placeholder="e.g., ACME"
                helperText="Optional: A shorter version of your organization name"
              />

              <TextField
                label="Contact Email"
                fullWidth
                required
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                placeholder="admin@example.com"
                helperText="Primary contact email for the organization"
              />

              <TextField
                label="Admin Full Name"
                fullWidth
                required
                value={formData.adminFullName}
                onChange={(e) => handleFieldChange('adminFullName', e.target.value)}
                placeholder="John Doe"
                helperText="Name of the organization administrator"
              />

              <TextField
                label="Phone Number"
                fullWidth
                value={formData.phoneNumber}
                onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                placeholder="+1 (555) 123-4567"
                helperText="Optional: Contact phone number"
              />
            </Stack>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Organization Details
            </Typography>

            <Stack spacing={2} sx={{ mt: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Organization Type
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {formData.accountType === 'business' ? (
                    <BusinessIcon sx={{ fontSize: 20 }} />
                  ) : (
                    <PersonIcon sx={{ fontSize: 20 }} />
                  )}
                  <Typography variant="body1">
                    {formData.accountType === 'business' ? 'Business' : 'Individual'}
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Organization Name
                </Typography>
                <Typography variant="body1">{formData.registeredName}</Typography>
              </Box>

              {formData.shortName && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Short Name
                  </Typography>
                  <Typography variant="body1">{formData.shortName}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Contact Email
                </Typography>
                <Typography variant="body1">{formData.contactEmail}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Administrator
                </Typography>
                <Typography variant="body1">{formData.adminFullName}</Typography>
              </Box>

              {formData.phoneNumber && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Phone Number
                  </Typography>
                  <Typography variant="body1">{formData.phoneNumber}</Typography>
                </Box>
              )}
            </Stack>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="caption">
                By creating this organization, you will become its owner and administrator.
                You can invite other members after creation.
              </Typography>
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5">Create New Organization</Typography>
          <IconButton
            onClick={handleClose}
            disabled={loading}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>

        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <LoadingButton
            variant="contained"
            onClick={handleSubmit}
            loading={loading}
            loadingPosition="start"
          >
            Create Organization
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
};