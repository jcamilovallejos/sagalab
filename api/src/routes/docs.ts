import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

// El registry se va llenando fase a fase con los schemas de zod de cada endpoint.
export const openApiRegistry = new OpenAPIRegistry();

function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'sagalab API',
      version: '0.0.0',
    },
  });
}

export function docsRouter(): Router {
  const router = Router();

  router.use('/docs', swaggerUi.serve, swaggerUi.setup(buildOpenApiDocument()));

  return router;
}
