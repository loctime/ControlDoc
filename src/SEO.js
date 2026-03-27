// Componente SEO reutilizable con React Helmet
import { Helmet } from "react-helmet";

export default function SEO({ title, description, keywords, url, image }) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content="index, follow" />
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta httpEquiv="Content-Language" content="es" />
    </Helmet>
  );
}
