#!/usr/bin/env node
/**
 * ====================================================================
 *  🔍 Career-Ops Job Scanner — Automated Job Discovery Engine
 * ====================================================================
 * 
 * Scan 3 free remote job APIs, filter by your profile, and rank matches.
 * 
 * APIs Used (No API Key Required):
 *   1. Himalayas  — https://himalayas.app/jobs/api
 *   2. Remotive   — https://remotive.com/api/remote-jobs
 *   3. Arbeitnow  — https://www.arbeitnow.com/api/job-board-api
 * 
 * Usage:
 *   node scripts/job-scanner.mjs                    → Scan semua
 *   node scripts/job-scanner.mjs --top 10           → Top 10 aja
 *   node scripts/job-scanner.mjs --keyword "nextjs" → Filter by keyword
 * 
 * Output: reports/scan-{YYYY-MM-DD}.md
 * ====================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── CANDIDATE PROFILE ───────────────────────────────────────────────
// Keywords yang match sama skill kamu — digunakan untuk scoring
const PROFILE = {
  // Skills kamu (untuk matching)
  skills: [
    'react', 'next.js', 'nextjs', 'next', 'typescript', 'javascript',
    'node.js', 'nodejs', 'node', 'tailwind', 'css', 'html',
    'postgresql', 'postgres', 'prisma', 'rest api', 'restful',
    'websocket', 'frontend', 'front-end', 'fullstack', 'full-stack',
    'full stack', 'web developer', 'software engineer',
    'python', 'git', 'github', 'aws', 'vercel', 'docker',
    'e-commerce', 'ecommerce', 'marketplace', 'saas', 'dashboard',
    'blockchain', 'web3', 'stripe', 'graphql', 'redis'
  ],

  // Title yang kamu target
  targetTitles: [
    'full stack', 'fullstack', 'frontend', 'front-end', 'front end',
    'react', 'next.js', 'nextjs', 'web developer', 'software engineer',
    'junior', 'mid', 'intern', 'entry', 'developer', 'engineer'
  ],

  // Keywords yang jadi RED FLAG (auto-downrank)
  redFlags: [
    'senior', 'staff', 'lead', 'principal', 'director', 'head of',
    'manager', '10+ years', '8+ years', '7+ years', 'phd',
    'c++', 'c#', '.net', 'ruby', 'scala', 'rust', 'golang',
    'ios', 'android', 'mobile', 'flutter', 'swift', 'kotlin',
    'devops', 'sre', 'platform engineer', 'data scientist',
    'machine learning', 'ml engineer', 'ai engineer'
  ],

  // Keywords yang jadi BONUS (auto-uprank)
  bonusKeywords: [
    'remote', 'worldwide', 'anywhere', 'global',
    'junior', 'entry', 'intern', 'early career',
    'startup', 'e-commerce', 'marketplace', 'saas',
    'react', 'next.js', 'nextjs', 'typescript',
    'no experience required', 'bootcamp', 'self-taught'
  ]
};

// ─── API SOURCES ──────────────────────────────────────────────────────

/**
 * Fetch dari Himalayas API
 * Docs: https://himalayas.app/jobs/api
 */
async function fetchHimalayas() {
  console.log('  📡 Scanning Himalayas...');
  const jobs = [];

  // Search dengan beberapa keyword
  const queries = ['react', 'nextjs', 'full stack', 'frontend', 'web developer', 'typescript'];

  for (const q of queries) {
    try {
      const url = `https://himalayas.app/jobs/api?limit=20&offset=0`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) continue;
      const data = await res.json();

      if (data.jobs && Array.isArray(data.jobs)) {
        for (const job of data.jobs) {
          jobs.push({
            source: 'Himalayas',
            title: job.title || '',
            company: job.companyName || job.company_name || '',
            location: job.location || 'Remote',
            url: job.applicationUrl || job.url || `https://himalayas.app/jobs/${job.id}`,
            description: job.description || job.excerpt || '',
            salary: job.salaryCurrency ? `${job.salaryCurrency} ${job.salaryMin || '?'}-${job.salaryMax || '?'}` : 'Not specified',
            date: job.pubDate || job.publishedAt || job.created_at || '',
            tags: job.categories || job.tags || [],
            seniority: job.seniority || ''
          });
        }
      }
    } catch (e) {
      console.log(`    ⚠️ Himalayas query "${q}" failed: ${e.message}`);
    }
  }

  return dedup(jobs);
}

/**
 * Fetch dari Remotive API
 * Docs: https://github.com/remotiveio/remote-jobs-api
 */
async function fetchRemotive() {
  console.log('  📡 Scanning Remotive...');
  const jobs = [];

  // Fetch software-dev category
  const categories = ['software-dev', 'frontend-dev', 'backend'];

  for (const cat of categories) {
    try {
      const url = `https://remotive.com/api/remote-jobs?category=${cat}&limit=30`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) continue;
      const data = await res.json();

      if (data.jobs && Array.isArray(data.jobs)) {
        for (const job of data.jobs) {
          jobs.push({
            source: 'Remotive',
            title: job.title || '',
            company: job.company_name || '',
            location: job.candidate_required_location || 'Worldwide',
            url: job.url || '',
            description: job.description || '',
            salary: job.salary || 'Not specified',
            date: job.publication_date || '',
            tags: job.tags || [],
            seniority: ''
          });
        }
      }
    } catch (e) {
      console.log(`    ⚠️ Remotive "${cat}" failed: ${e.message}`);
    }
  }

  return dedup(jobs);
}

/**
 * Fetch dari Arbeitnow API
 * Docs: https://www.arbeitnow.com/api/job-board-api
 */
async function fetchArbeitnow() {
  console.log('  📡 Scanning Arbeitnow...');
  const jobs = [];

  try {
    const url = 'https://www.arbeitnow.com/api/job-board-api';
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return jobs;
    const data = await res.json();

    const items = data.data || data.jobs || data;
    if (Array.isArray(items)) {
      for (const job of items) {
        // Hanya ambil yang remote
        if (job.remote === true || (job.location && job.location.toLowerCase().includes('remote'))) {
          jobs.push({
            source: 'Arbeitnow',
            title: job.title || '',
            company: job.company_name || '',
            location: job.location || 'Remote',
            url: job.url || '',
            description: job.description || '',
            salary: 'Not specified',
            date: job.created_at || '',
            tags: job.tags || [],
            seniority: ''
          });
        }
      }
    }
  } catch (e) {
    console.log(`    ⚠️ Arbeitnow failed: ${e.message}`);
  }

  return jobs;
}

// ─── SCORING ENGINE ───────────────────────────────────────────────────

/**
 * Score setiap job berdasarkan profile kandidat
 * Score 0-100, semakin tinggi = semakin cocok
 */
function scoreJob(job) {
  let score = 0;
  const text = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase();
  const title = job.title.toLowerCase();

  // 1. SKILL MATCH (max 40 points)
  let skillMatches = 0;
  const matchedSkills = [];
  for (const skill of PROFILE.skills) {
    if (text.includes(skill.toLowerCase())) {
      skillMatches++;
      matchedSkills.push(skill);
    }
  }
  score += Math.min(40, skillMatches * 5);

  // 2. TITLE MATCH (max 25 points)
  let titleMatch = 0;
  for (const t of PROFILE.targetTitles) {
    if (title.includes(t.toLowerCase())) {
      titleMatch += 5;
    }
  }
  score += Math.min(25, titleMatch);

  // 3. BONUS KEYWORDS (max 20 points)
  for (const bonus of PROFILE.bonusKeywords) {
    if (text.includes(bonus.toLowerCase())) {
      score += 2;
    }
  }
  score = Math.min(score, 85); // cap before penalties

  // 4. RED FLAG PENALTIES (up to -40 points)
  let redFlagCount = 0;
  const flagsFound = [];
  for (const flag of PROFILE.redFlags) {
    if (text.includes(flag.toLowerCase())) {
      redFlagCount++;
      flagsFound.push(flag);
    }
  }
  score -= redFlagCount * 5;

  // 5. RECENCY BONUS (max 15 points)
  if (job.date) {
    const jobDate = new Date(job.date);
    const daysSincePosted = (Date.now() - jobDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePosted <= 1) score += 15;
    else if (daysSincePosted <= 3) score += 10;
    else if (daysSincePosted <= 7) score += 5;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    ...job,
    score,
    matchedSkills: matchedSkills.slice(0, 8),
    redFlags: flagsFound,
    verdict: score >= 60 ? '🟢 APPLY!' : score >= 35 ? '🟡 CONSIDER' : '🔴 SKIP'
  };
}

// ─── UTILITIES ────────────────────────────────────────────────────────

function dedup(jobs) {
  const seen = new Set();
  return jobs.filter(j => {
    const key = `${j.title}|${j.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

// ─── REPORT GENERATOR ────────────────────────────────────────────────

function generateReport(scoredJobs, stats) {
  const now = new Date().toISOString().split('T')[0];
  const applyJobs = scoredJobs.filter(j => j.verdict === '🟢 APPLY!');
  const considerJobs = scoredJobs.filter(j => j.verdict === '🟡 CONSIDER');
  const skipJobs = scoredJobs.filter(j => j.verdict === '🔴 SKIP');

  let md = `# 🔍 Job Scanner Report
**Date:** ${now}
**Total Scanned:** ${stats.total} jobs across ${stats.sources} platforms
**Processing Time:** ${stats.duration}s

---

## 📊 Summary

\`\`\`
🟢 APPLY!    ${applyJobs.length} jobs (score ≥ 70)
🟡 CONSIDER  ${considerJobs.length} jobs (score 50-69)
🔴 SKIP      ${skipJobs.length} jobs (score < 50)
\`\`\`

---

## 🏆 TOP MATCHES (Score ≥ 70) — APPLY THESE!

`;

  if (applyJobs.length === 0) {
    md += `> Belum ada yang perfect match hari ini. Cek "CONSIDER" di bawah.\n\n`;
  } else {
    for (const job of applyJobs) {
      md += `### ${job.verdict} ${job.title} @ ${job.company} — **${job.score}%**
| Field | Detail |
|-------|--------|
| Source | ${job.source} |
| Location | ${job.location} |
| Salary | ${job.salary} |
| Posted | ${formatDate(job.date)} |
| Skills Match | ${job.matchedSkills.join(', ') || 'N/A'} |
| 🔗 Link | [Apply Here](${job.url}) |

---
`;
    }
  }

  md += `\n## 🟡 WORTH CONSIDERING (Score 50-69)\n\n`;

  if (considerJobs.length === 0) {
    md += `> Tidak ada di kategori ini.\n\n`;
  } else {
    md += `| # | Score | Title | Company | Source | Skills | Link |
|---|-------|-------|---------|--------|--------|------|
`;
    considerJobs.forEach((job, i) => {
      md += `| ${i + 1} | ${job.score}% | ${job.title} | ${job.company} | ${job.source} | ${job.matchedSkills.slice(0, 4).join(', ')} | [Link](${job.url}) |
`;
    });
  }

  md += `\n---\n\n## 📈 Scan Statistics\n
| Metric | Value |
|--------|-------|
| Himalayas | ${stats.himalayas} jobs |
| Remotive | ${stats.remotive} jobs |
| Arbeitnow | ${stats.arbeitnow} jobs |
| Total Raw | ${stats.totalRaw} |
| After Filter | ${stats.total} |
| Avg Score | ${stats.avgScore}% |

---
*Run again: \`node scripts/job-scanner.mjs\`*
`;

  return md;
}

// ─── MAIN EXECUTION ──────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  🔍 Career-Ops Job Scanner v1.0             ║');
  console.log('║  Scanning 3 platforms for matching jobs...   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  // Parse CLI args
  const args = process.argv.slice(2);
  const topN = args.includes('--top') ? parseInt(args[args.indexOf('--top') + 1]) || 20 : 20;
  const keyword = args.includes('--keyword') ? args[args.indexOf('--keyword') + 1] : null;

  // 1. FETCH FROM ALL SOURCES
  console.log('📡 Fetching jobs from all sources...\n');

  const [himalayas, remotive, arbeitnow] = await Promise.all([
    fetchHimalayas(),
    fetchRemotive(),
    fetchArbeitnow()
  ]);

  console.log(`\n  ✅ Himalayas: ${himalayas.length} jobs`);
  console.log(`  ✅ Remotive:  ${remotive.length} jobs`);
  console.log(`  ✅ Arbeitnow: ${arbeitnow.length} jobs`);

  // 2. COMBINE & DEDUP
  let allJobs = dedup([...himalayas, ...remotive, ...arbeitnow]);
  const totalRaw = allJobs.length;
  console.log(`\n  📋 Total unique jobs: ${totalRaw}`);

  // 3. KEYWORD FILTER (optional)
  if (keyword) {
    allJobs = allJobs.filter(j =>
      `${j.title} ${j.description}`.toLowerCase().includes(keyword.toLowerCase())
    );
    console.log(`  🔎 After keyword filter ("${keyword}"): ${allJobs.length}`);
  }

  // 4. SCORE ALL JOBS
  console.log('\n  🧠 Scoring jobs against your profile...');
  const scoredJobs = allJobs
    .map(scoreJob)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const avgScore = scoredJobs.length > 0
    ? Math.round(scoredJobs.reduce((s, j) => s + j.score, 0) / scoredJobs.length)
    : 0;

  // 5. DISPLAY TOP RESULTS
  console.log('\n');
  console.log('┌──────── TOP MATCHES ────────┐');
  console.log('│                             │');

  const applyJobs = scoredJobs.filter(j => j.verdict === '🟢 APPLY!');
  const considerJobs = scoredJobs.filter(j => j.verdict === '🟡 CONSIDER');

  for (const job of applyJobs.slice(0, 5)) {
    console.log(`│ 🟢 ${job.score}% | ${(job.title + ' @ ' + job.company).slice(0, 40).padEnd(40)} │`);
  }
  for (const job of considerJobs.slice(0, 5)) {
    console.log(`│ 🟡 ${job.score}% | ${(job.title + ' @ ' + job.company).slice(0, 40).padEnd(40)} │`);
  }

  if (applyJobs.length === 0 && considerJobs.length === 0) {
    console.log('│ ⚠️  No strong matches found today      │');
  }

  console.log('│                             │');
  console.log('└─────────────────────────────┘');

  // 6. GENERATE REPORT
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = {
    total: scoredJobs.length,
    totalRaw,
    sources: 3,
    duration,
    himalayas: himalayas.length,
    remotive: remotive.length,
    arbeitnow: arbeitnow.length,
    avgScore
  };

  const report = generateReport(scoredJobs, stats);

  // Save report
  const reportDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const reportFile = path.join(reportDir, `scan-${new Date().toISOString().split('T')[0]}.md`);
  fs.writeFileSync(reportFile, report, 'utf-8');

  console.log(`\n  💾 Report saved: ${reportFile}`);
  console.log(`\n  🟢 APPLY: ${applyJobs.length} | 🟡 CONSIDER: ${considerJobs.length} | 🔴 SKIP: ${scoredJobs.length - applyJobs.length - considerJobs.length}`);
  console.log(`  ⏱️  Completed in ${duration}s\n`);
}

main().catch(err => {
  console.error('❌ Scanner failed:', err.message);
  process.exit(1);
});
