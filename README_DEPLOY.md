# Deploy Instructions (Render.com)

1. Push this repo to GitHub (create repo named jee-mocktests and push).
2. On Render, create a new Web Service -> Connect GitHub -> select this repo.
3. In Render service settings -> Build & Deploy:
   - Build Command:
     cd client && npm install && npm run build && cd ../server && npm install
   - Start Command:
     cd server && npm start
4. Add environment variables in Render (Dashboard → Environment):
   - DATABASE_URL=postgres://<user>:<pass>@<host>:5432/<db>
   - JWT_SECRET=your_jwt_secret_here
   - NODE_ENV=production
   - PORT=5000 (optional)
5. Add a managed Postgres Database on Render or connect an external one, set DATABASE_URL accordingly.
6. Deploy the service and watch logs. After successful build, visit the provided URL.
