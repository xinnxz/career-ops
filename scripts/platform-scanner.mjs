#!/usr/bin/env node
/**
 * ====================================================================
 *  🌐 Career-Ops Platform Scanner v1.0
 * ====================================================================
 * 
 * Scan LinkedIn, JobStreet, dan Twine menggunakan Playwright.
 * Tanpa API key, tanpa login. Pakai halaman publik.
 * 
 * Usage:
 *   node scripts/platform-scanner.mjs                     → Scan semua
 *   node scripts/platform-scanner.mjs --platform linkedin  → LinkedIn aja
 *   node scripts/platform-scanner.mjs --platform jobstreet → JobStreet aja
 *   node scripts/platform-scanner.mjs --platform twine     → Twine aja
 * 
 * Prerequisites: npm install playwright (sudah terinstall)
 * ====================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── SEARCH CONFIG ────────────────────────────────────────────────────
// Keyword pencarian yang disesuaikan per platform
const SEARCH_CONFIG = {
  // Keyword utama untuk dicari
  queries: [
    'full stack developer remote',
    'frontend developer remote',
    'react developer remote',
    'next.js developer remote',
    'junior software engineer remote'
  ],

  // Untuk scoring (sama dengan job-scanner.mjs)
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
  targetTitles: [
    'full stack', 'fullstack', 'frontend', 'front-end', 'front end',
    'react', 'next.js', 'nextjs', 'web developer', 'software engineer',
    'junior', 'mid', 'intern', 'entry', 'developer', 'engineer'
  ],
  redFlags: [
    'senior', 'staff', 'lead', 'principal', 'director', 'head of',
    'manager', '10+ years', '8+ years', '7+ years', 'phd',
    'c++', 'c#', '.net', 'ruby', 'scala', 'rust', 'golang',
    'ios', 'android', 'mobile', 'flutter', 'swift', 'kotlin'
  ],
  bonusKeywords: [
    'remote', 'worldwide', 'anywhere', 'global',
    'junior', 'entry', 'intern', 'early career',
    'startup', 'e-commerce', 'marketplace', 'saas',
    'react', 'next.js', 'nextjs', 'typescript'
  ]
};

// ─── LINKEDIN SCRAPER ─────────────────────────────────────────────────

/**
 * LinkedIn Jobs — Halaman publik (tanpa login)
 * URL: https://www.linkedin.com/jobs/search/?keywords=...&location=Worldwide&f_WT=2
 * f_WT=2 = Remote filter
 */
async function scrapeLinkedIn(page) {
  console.log('  🔵 Scanning LinkedIn...');
  const jobs = [];
  
  // LinkedIn search queries
  const queries = [
    'react developer',
    'full stack developer', 
    'frontend developer',
    'next.js developer',
    'junior software engineer'
  ];

  for (const query of queries) {
    try {
      // f_WT=2 = Remote, sortBy=DD = Most Recent
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=Worldwide&f_WT=2&sortBy=DD&position=1&pageNum=0`;
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000); // Wait for JS render

      // Extract job cards dari halaman publik LinkedIn
      const listings = await page.evaluate(() => {
        const cards = document.querySelectorAll('.base-card, .job-search-card, [data-tracking-control-name="public_jobs_jserp-result"]');
        const results = [];
        
        cards.forEach(card => {
          const titleEl = card.querySelector('.base-search-card__title, h3, .job-search-card__title');
          const companyEl = card.querySelector('.base-search-card__subtitle, h4, .job-search-card__company-name');
          const locationEl = card.querySelector('.job-search-card__location, .base-search-card__metadata');
          const linkEl = card.querySelector('a[href*="/jobs/view/"], a[href*="/jobs/"]');
          const dateEl = card.querySelector('time, .job-search-card__listdate');

          if (titleEl) {
            results.push({
              title: titleEl.textContent.trim(),
              company: companyEl ? companyEl.textContent.trim() : 'Unknown',
              location: locationEl ? locationEl.textContent.trim() : 'Remote',
              url: linkEl ? linkEl.href : '',
              date: dateEl ? (dateEl.getAttribute('datetime') || dateEl.textContent.trim()) : ''
            });
          }
        });
        
        return results;
      });

      for (const listing of listings) {
        jobs.push({
          source: 'LinkedIn',
          title: listing.title,
          company: listing.company,
          location: listing.location,
          url: listing.url,
          description: `${listing.title} at ${listing.company}`,
          salary: 'Not specified',
          date: listing.date,
          tags: []
        });
      }

      console.log(`    ✓ "${query}" → ${listings.length} jobs`);
    } catch (e) {
      console.log(`    ⚠️ "${query}" failed: ${e.message.slice(0, 50)}`);
    }
  }

  return dedup(jobs);
}

// ─── JOBSTREET SCRAPER ────────────────────────────────────────────────

/**
 * JobStreet (Indonesia) — Halaman publik
 * URL: https://www.jobstreet.co.id/id/jobs?q=...&workArrangement=remote
 */
async function scrapeJobStreet(page) {
  console.log('  🟠 Scanning JobStreet Indonesia...');
  const jobs = [];

  const queries = [
    'full stack developer',
    'frontend developer',
    'react developer', 
    'web developer',
    'software engineer'
  ];

  for (const query of queries) {
    try {
      const url = `https://www.jobstreet.co.id/id/${encodeURIComponent(query)}-jobs?sortmode=ListedDate`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const listings = await page.evaluate(() => {
        const results = [];
        
        // JobStreet uses various card structures
        const cards = document.querySelectorAll('[data-automation="jobListing"], article, [data-testid="job-card"]');
        
        cards.forEach(card => {
          const titleEl = card.querySelector('a[data-automation="jobTitle"], h1 a, h3 a, [data-automation="job-list-item-link-overlay"]');
          const companyEl = card.querySelector('[data-automation="jobCompany"], span[data-automation="jobCompany"], a[data-automation="jobCompany"]');
          const locationEl = card.querySelector('[data-automation="jobLocation"], span[data-automation="jobLocation"]');
          const salaryEl = card.querySelector('[data-automation="jobSalary"], span[data-automation="jobSalary"]');
          const dateEl = card.querySelector('time, [data-automation="jobListingDate"], span[data-automation="jobListingDate"]');

          if (titleEl) {
            results.push({
              title: titleEl.textContent.trim(),
              company: companyEl ? companyEl.textContent.trim() : 'Unknown',
              location: locationEl ? locationEl.textContent.trim() : 'Indonesia',
              url: titleEl.href || '',
              salary: salaryEl ? salaryEl.textContent.trim() : 'Not specified',
              date: dateEl ? dateEl.textContent.trim() : ''
            });
          }
        });

        // Fallback: try generic link extraction
        if (results.length === 0) {
          const links = document.querySelectorAll('a[href*="/job/"], a[href*="/jobs/"]');
          links.forEach(link => {
            const text = link.textContent.trim();
            if (text.length > 5 && text.length < 100) {
              results.push({
                title: text,
                company: 'See listing',
                location: 'Indonesia',
                url: link.href,
                salary: 'Not specified',
                date: ''
              });
            }
          });
        }
        
        return results;
      });

      for (const listing of listings) {
        jobs.push({
          source: 'JobStreet',
          title: listing.title,
          company: listing.company,
          location: listing.location,
          url: listing.url,
          description: `${listing.title} at ${listing.company}`,
          salary: listing.salary,  
          date: listing.date,
          tags: []
        });
      }

      console.log(`    ✓ "${query}" → ${listings.length} jobs`);
    } catch (e) {
      console.log(`    ⚠️ "${query}" failed: ${e.message.slice(0, 50)}`);
    }
  }

  return dedup(jobs);
}

// ─── TWINE SCRAPER ────────────────────────────────────────────────────

/**
 * Twine.net — Freelance job platform
 * URL: https://www.twine.net/jobs/full-stack-developer
 */
async function scrapeTwine(page) {
  console.log('  🟣 Scanning Twine...');
  const jobs = [];

  const categories = [
    'full-stack-developer',
    'front-end-developer', 
    'web-developer',
    'back-end-developer'
  ];

  for (const cat of categories) {
    try {
      const url = `https://www.twine.net/jobs/${cat}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      
      // Scroll down to load more
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);

      const listings = await page.evaluate(() => {
        const results = [];
        
        // Twine job cards
        const cards = document.querySelectorAll('a[href*="/projects/"]');
        
        cards.forEach(card => {
          const href = card.href || '';
          const text = card.textContent.trim();
          
          // Filter valid job links (not nav links)
          if (href.includes('/projects/') && text.length > 10 && !href.includes('pricing')) {
            // Parse job info from card text
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            results.push({
              title: lines[0] || text.slice(0, 80),
              company: lines[1] || 'Client',
              url: href,
              budget: lines.find(l => l.includes('$') || l.includes('USD') || l.includes('Budget')) || 'Not specified'
            });
          }
        });
        
        return results;
      });

      for (const listing of listings) {
        jobs.push({
          source: 'Twine',
          title: listing.title,
          company: listing.company,
          location: 'Remote',
          url: listing.url,
          description: listing.title,
          salary: listing.budget,
          date: '',
          tags: []
        });
      }

      console.log(`    ✓ "${cat}" → ${listings.length} jobs`);
    } catch (e) {
      console.log(`    ⚠️ "${cat}" failed: ${e.message.slice(0, 50)}`);
    }
  }

  return dedup(jobs);
}

// ─── SCORING ENGINE ───────────────────────────────────────────────────

function scoreJob(job) {
  let score = 0;
  const text = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase();
  const title = job.title.toLowerCase();

  let skillMatches = 0;
  const matchedSkills = [];
  for (const skill of SEARCH_CONFIG.skills) {
    if (text.includes(skill.toLowerCase())) {
      skillMatches++;
      matchedSkills.push(skill);
    }
  }
  score += Math.min(40, skillMatches * 5);

  let titleMatch = 0;
  for (const t of SEARCH_CONFIG.targetTitles) {
    if (title.includes(t.toLowerCase())) titleMatch += 5;
  }
  score += Math.min(25, titleMatch);

  for (const bonus of SEARCH_CONFIG.bonusKeywords) {
    if (text.includes(bonus.toLowerCase())) score += 2;
  }
  score = Math.min(score, 85);

  let redFlagCount = 0;
  const flagsFound = [];
  for (const flag of SEARCH_CONFIG.redFlags) {
    if (text.includes(flag.toLowerCase())) {
      redFlagCount++;
      flagsFound.push(flag);
    }
  }
  score -= redFlagCount * 5;

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
    const key = `${j.title}|${j.company}`.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return 'Recent';
  try { return new Date(dateStr).toISOString().split('T')[0]; }
  catch { return dateStr; }
}

// ─── REPORT GENERATOR ────────────────────────────────────────────────

function generateReport(scoredJobs, stats) {
  const now = new Date().toISOString().split('T')[0];
  const applyJobs = scoredJobs.filter(j => j.verdict === '🟢 APPLY!');
  const considerJobs = scoredJobs.filter(j => j.verdict === '🟡 CONSIDER');

  let md = `# 🌐 Platform Scanner Report — ${now}
**Platforms:** LinkedIn, JobStreet, Twine
**Total Found:** ${stats.total} jobs
**Time:** ${stats.duration}s

---

## 📊 Summary

\`\`\`
🟢 APPLY!    ${applyJobs.length} jobs (score ≥ 60)
🟡 CONSIDER  ${considerJobs.length} jobs (score 35-59)
🔴 SKIP      ${scoredJobs.length - applyJobs.length - considerJobs.length} jobs (score < 35)
\`\`\`

| Platform | Jobs Found |
|----------|-----------|
| 🔵 LinkedIn | ${stats.linkedin} |
| 🟠 JobStreet | ${stats.jobstreet} |
| 🟣 Twine | ${stats.twine} |

---

## 🏆 TOP MATCHES — APPLY THESE!

`;

  for (const job of applyJobs) {
    md += `### ${job.verdict} ${job.title} @ ${job.company} — **${job.score}%**
| | |
|---|---|
| Source | ${job.source} |
| Location | ${job.location} |
| Salary | ${job.salary} |
| Skills | ${job.matchedSkills.join(', ')} |
| 🔗 | [Apply](${job.url}) |

---
`;
  }

  if (applyJobs.length === 0) md += '> Belum ada yang ≥60% hari ini.\n\n';

  md += `\n## 🟡 CONSIDER\n\n`;
  md += `| # | Score | Title | Company | Platform | Link |\n|---|-------|-------|---------|----------|------|\n`;
  considerJobs.forEach((j, i) => {
    md += `| ${i+1} | ${j.score}% | ${j.title.slice(0,40)} | ${j.company.slice(0,20)} | ${j.source} | [Link](${j.url}) |\n`;
  });

  md += `\n---\n*Run: \`npm run scan:platforms\`*\n`;
  return md;
}

// ─── MAIN ─────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🌐 Career-Ops Platform Scanner v1.0            ║');
  console.log('║  LinkedIn + JobStreet + Twine                    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();
  const args = process.argv.slice(2);
  const platformFilter = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'all';

  // Launch browser
  console.log('  🚀 Launching browser...\n');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let linkedin = [], jobstreet = [], twine = [];

  try {
    // Scan platforms
    if (platformFilter === 'all' || platformFilter === 'linkedin') {
      linkedin = await scrapeLinkedIn(page);
    }
    if (platformFilter === 'all' || platformFilter === 'jobstreet') {
      jobstreet = await scrapeJobStreet(page);
    }
    if (platformFilter === 'all' || platformFilter === 'twine') {
      twine = await scrapeTwine(page);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n  📊 Results:`);
  console.log(`    🔵 LinkedIn:  ${linkedin.length} jobs`);
  console.log(`    🟠 JobStreet: ${jobstreet.length} jobs`);
  console.log(`    🟣 Twine:     ${twine.length} jobs`);

  // Score & rank
  const allJobs = dedup([...linkedin, ...jobstreet, ...twine]);
  const scored = allJobs.map(scoreJob).sort((a, b) => b.score - a.score);

  const applyJobs = scored.filter(j => j.verdict === '🟢 APPLY!');
  const considerJobs = scored.filter(j => j.verdict === '🟡 CONSIDER');

  console.log('\n');
  console.log('┌──────── TOP MATCHES ────────┐');
  for (const j of [...applyJobs, ...considerJobs].slice(0, 10)) {
    const icon = j.verdict.startsWith('🟢') ? '🟢' : '🟡';
    console.log(`│ ${icon} ${j.score}% | ${(j.title + ' @ ' + j.company).slice(0, 42).padEnd(42)} │`);
  }
  if (applyJobs.length === 0 && considerJobs.length === 0) {
    console.log('│ ⚠️  Belum ada strong match hari ini       │');
  }
  console.log('└─────────────────────────────┘');

  // Save report
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = {
    total: allJobs.length,
    duration,
    linkedin: linkedin.length,
    jobstreet: jobstreet.length,
    twine: twine.length
  };

  const reportDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  
  const report = generateReport(scored, stats);
  const reportFile = path.join(reportDir, `platform-scan-${new Date().toISOString().split('T')[0]}.md`);
  fs.writeFileSync(reportFile, report, 'utf-8');

  console.log(`\n  💾 Report: ${reportFile}`);
  console.log(`  🟢 APPLY: ${applyJobs.length} | 🟡 CONSIDER: ${considerJobs.length} | Total: ${allJobs.length}`);
  console.log(`  ⏱️  Done in ${duration}s\n`);
}

main().catch(err => {
  console.error('❌ Scanner failed:', err.message);
  process.exit(1);
});
