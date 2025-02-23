// pages/_app.js
import '../app/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <Component {...pageProps} />
    </>
  );
}
