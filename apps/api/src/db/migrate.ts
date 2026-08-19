import { execSync } from 'child_process'

execSync('npx prisma migrate dev --name init', {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: { ...process.env }
})
