import { buildApp } from './app.ts';
import { loadEnv } from './config/env.ts';

const env = loadEnv();
const app = buildApp(env);

app.listen(env.PORT, () => {
  console.log(`sagalab api escuchando en :${env.PORT}`);
});
