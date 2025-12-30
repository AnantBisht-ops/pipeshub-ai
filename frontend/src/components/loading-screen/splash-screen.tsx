import type { BoxProps } from '@mui/material/Box';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Portal from '@mui/material/Portal';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  portal?: boolean;
};

export function SplashScreen({ portal = true, sx, ...other }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [dotOpacity, setDotOpacity] = useState([0.4, 0.6, 0.8]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const content = (
    <Box sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          right: 0,
          width: 1,
          bottom: 0,
          height: 1,
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#1a1a1a', // Dark charcoal background for OpenAnalyst
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
          ...sx,
        }}
        {...other}
      >
        <Box
          component="img"
          src="/OA.avif"
          alt="OpenAnalyst Logo"
          onLoad={handleImageLoad}
          onError={(e) => {
            console.error('Failed to load OpenAnalyst logo:', e);
            // Fallback to showing something
            setImageLoaded(true);
          }}
          sx={{
            width: { xs: 120, sm: 150, md: 180 },
            height: 'auto',
            transition: 'all 0.8s ease-out',
            transform: loaded ? 'scale(1)' : 'scale(0.8)',
            opacity: imageLoaded ? 1 : 0,
          }}
        />
        
        {/* Loading indicators */}
        <Box 
          sx={{ 
            mt: 4,
            display: 'flex',
            gap: 1.5
          }}
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: '#70CDA7',
                opacity: dotOpacity[i], 
                transition: 'opacity 0.3s ease',
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );

  if (portal) {
    return <Portal>{content}</Portal>;
  }

  return content;
}