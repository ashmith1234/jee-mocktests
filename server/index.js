const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database: use DATABASE_URL from env (Postgres)
const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/jeedb';
const sequelize = new Sequelize(databaseUrl, { dialect: 'postgres', logging: false });

// Simple models: User, Question, Attempt (minimal)
const User = sequelize.define('User', { name: DataTypes.STRING, email: DataTypes.STRING });
const Question = sequelize.define('Question', { subject: DataTypes.STRING, text: DataTypes.TEXT, options: DataTypes.JSON, answerIndex: DataTypes.INTEGER, difficulty: DataTypes.STRING, topics: DataTypes.JSON });
const Attempt = sequelize.define('Attempt', { userId: DataTypes.INTEGER, answers: DataTypes.JSON, score: DataTypes.FLOAT, totalMarks: DataTypes.FLOAT, predictedPercentile: DataTypes.JSON, predictedRank: DataTypes.JSON, sessionYear: DataTypes.INTEGER, questions: DataTypes.JSON, meta: DataTypes.JSON });

app.get('/api/health', (req,res)=> res.json({ ok:true }));

app.get('/api/percentile_trends', (req,res)=> {
  const p = require('./percentile_trends.json');
  res.json(p);
});

app.post('/api/attempt/start', async (req,res)=> {
  const { userId, questionSet, meta } = req.body;
  await sequelize.sync();
  const attempt = await Attempt.create({ userId: userId || null, questions: questionSet || [], answers: {}, score:0, totalMarks: questionSet ? questionSet.length*4 : 0, meta });
  res.json({ attemptId: attempt.id });
});

app.post('/api/attempt/submit', async (req,res)=> {
  const { attemptId, answers, sessionYear } = req.body;
  await sequelize.sync();
  const attempt = await Attempt.findByPk(attemptId);
  if(!attempt) return res.status(404).json({ error: 'not found' });
  let score = 0; let total = 0;
  const qids = Object.keys(answers || {});
  for(const qid of qids){
    const q = await Question.findByPk(qid);
    if(!q) continue;
    total += 4;
    if(answers[qid] === q.answerIndex) score += 4;
    else score -= 1;
  }
  attempt.answers = answers; attempt.score = score; attempt.totalMarks = total;
  // compute simple percentile interpolation from trends
  try{
    const trends = require('./percentile_trends.json');
    const year = sessionYear || Math.max(...Object.keys(trends).map(y=>Number(y)));
    const points = trends[String(year)];
    // linear interpolation over sample points
    let perc = 0;
    for(let i=0;i<points.length-1;i++){
      const a = points[i], b = points[i+1];
      if(score >= a.mark && score <= b.mark){
        const t = (score - a.mark) / (b.mark - a.mark || 1);
        perc = a.perc + t*(b.perc - a.perc);
        break;
      }
    }
    const minp = Math.max(0, perc - 0.6), maxp = Math.min(100, perc + 0.6);
    attempt.predictedPercentile = { min: minp, max: maxp, point: perc };
    // very rough candidate count
    const estCandidates = 1200000;
    const rankMin = Math.max(1, Math.round((1 - maxp/100) * estCandidates));
    const rankMax = Math.max(1, Math.round((1 - minp/100) * estCandidates));
    attempt.predictedRank = { min: rankMin, max: rankMax };
    attempt.sessionYear = year;
  }catch(e){ console.error('percentile compute', e); }
  await attempt.save();
  res.json({ ok:true, score, total, predictedPercentile: attempt.predictedPercentile, predictedRank: attempt.predictedRank, sessionYear: attempt.sessionYear });
});

// Serve static client build
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req,res)=> res.sendFile(path.join(__dirname, '../client/build/index.html')));

const port = process.env.PORT || 5000;
sequelize.authenticate().then(()=> console.log('DB connected')).catch(e=> console.warn('DB connect failed', e.message));
app.listen(port, ()=> console.log('Server listening on', port));
