import type { Theme, SxProps, Breakpoint } from '@mui/material/styles';

import { Section } from './section';
import { Main, Content } from './main';
import { LayoutSection } from '../core/layout-section';

// ----------------------------------------------------------------------

export type AuthSplitLayoutProps = {
  sx?: SxProps<Theme>;
  children: React.ReactNode;
  section?: {
    title?: string;
    imgUrl?: string;
    subtitle?: string;
  };
};

export function AuthSplitLayout({ sx, section, children }: AuthSplitLayoutProps) {
  const layoutQuery: Breakpoint = 'md';

  return (
    <LayoutSection
      headerSection={null} // Removed header
      footerSection={null}
      cssVars={{ '--layout-auth-content-width': '480px' }}
      sx={{
        backgroundColor: '#1a1a1a', // Dark charcoal background for OpenAnalyst
        minHeight: '100vh',
        ...sx,
      }}
    >
      <Main layoutQuery={layoutQuery}>
        {/* Section for illustration/info */}
        <Section
          layoutQuery={layoutQuery}
          title={section?.title}
          subtitle={section?.subtitle}
          imgUrl={section?.imgUrl}
        />

        {/* Content area (form) */}
        <Content
          layoutQuery={layoutQuery}
          sx={{
            backgroundColor: '#1a1a1a', // Consistent dark background
          }}
        >
          {children}
        </Content>
      </Main>
    </LayoutSection>
  );
}