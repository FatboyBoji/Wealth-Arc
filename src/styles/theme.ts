export const theme = {
  fonts: {
    primary: 'Chakra Petch, sans-serif',
  },
  fontSizes: {
    header: ['32px', '150%'],
    button: ['18px', '150%'],
    body: ['14px', '150%'],
  },
  colors: {
    background: '#192A38',
    primary: '#09BC8A',
    secondary: '#004346',
    dark: '#212121',
    light: '#F3FFFC',
    // Additional semantic colors
    text: {
      primary: '#F3FFFC',
      secondary: '#09BC8A',
    },
    card: {
      background: 'rgba(255, 255, 255, 0.1)', // For the semi-transparent cards
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
  }
}

export type Theme = typeof theme; 