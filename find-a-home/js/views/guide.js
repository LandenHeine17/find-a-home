/** "What to do next": step-by-step placement guide with saved progress. */
import { S } from '../core/state.js';
import { esc } from '../core/util.js';
import { lovedOne } from '../core/labels.js';
import { app } from '../router.js';
import { TOUR_QS } from '../components/modals.js';

const GUIDE = [
  { t: 'Get the diagnosis in writing', b: `Ask ${'{lo}'}'s doctor for a written diagnosis and a short summary of daily care needs. Memory care communities and Medicaid usually ask for it.`,
    more: ['Ask the doctor: "What stage is this, and what level of care do you recommend?"', 'Request a copy of the medication list.', 'If you\'re not the decision-maker yet, ask about power of attorney (healthcare and financial).'] },
  { t: 'Figure out how you\'ll pay', b: 'Most long-term dementia care is paid privately until savings run low. Then Medicaid may help.',
    more: ['<b>Medicare</b> pays only for short-term skilled nursing or rehab (up to 100 days after a qualifying hospital stay). It does not pay for long-term memory care. <a href="https://www.medicare.gov/coverage/skilled-nursing-facility-snf-care" target="_blank" rel="noopener">Medicare SNF coverage</a>',
      '<b>Nebraska Medicaid</b> covers nursing homes once assets are spent down. Its Aged & Disabled waiver can help with assisted living or in-home care. Apply through <a href="https://iserve.nebraska.gov" target="_blank" rel="noopener">iServe Nebraska</a>. Approval can take a month or more, so start early.',
      '<b>VA:</b> veterans and surviving spouses may qualify for <a href="https://www.va.gov/pension/aid-attendance-housebound/" target="_blank" rel="noopener">Aid & Attendance</a>.',
      '<b>Long-term care insurance:</b> call the insurer to start a claim and ask about the waiting period.'] },
  { t: 'Choose the type of care', b: 'Match the level of care to what your loved one needs now, and soon.',
    more: ['<b>In-home care:</b> caregivers come to the house for a few hours a day up to 24/7. Best in early stages, or when family lives nearby.', '<b>Assisted living:</b> an apartment with meals and help with daily tasks. Not always secured.', '<b>Memory care:</b> a secured, dementia-focused setting with trained staff. Good for wandering or confusion.', '<b>Nursing home:</b> 24-hour nursing for heavy medical needs. Rated by Medicare.'],
    link: ['#/results', 'See matches'] },
  { t: 'Shortlist and compare 2–3 places', b: 'Check safety first, then cost, distance and openings.', more: ['Use Compare to see places side by side.', 'Check Medicare inspection results for nursing homes.', 'Call to ask about openings and waitlists before you tour.'], link: ['#/compare', 'Open compare'] },
  { t: 'Tour, and bring your loved one if you can', b: 'Visit at a mealtime if possible. Watch how staff treat residents.', more: ['Bring the tour checklist.', 'Visit twice: once scheduled, once drop-in.', 'Ask for their latest state inspection report.'], checklist: true },
  { t: 'Apply and complete the assessments', b: 'The facility will do its own care assessment before move-in.', more: ['Nursing homes that take Medicaid must do a pre-admission screening (PASRR).', 'Medicaid also needs a level-of-care assessment.', 'Gather: photo ID, insurance and Medicare cards, power of attorney, medication list and doctor\'s orders.'] },
  { t: 'Plan the move', b: 'Familiar things help a lot with the change.', more: ['Bring photos, a favorite chair and blanket, and label clothing.', 'Share their routines, likes and triggers with staff.', 'Ask staff about the best visiting schedule for the first few weeks.'] },
  { t: 'After the move: check in', b: 'Dementia changes over time. Needs may change too.', more: ['Attend care plan meetings (usually every 3 months).', 'If things aren\'t right, contact the Long-Term Care Ombudsman through Aging Partners (402-441-7070).', 'Leave a review after about 30 days to help other families.', 'If needs change (for example, wandering starts), come back and update your answers.'] }
];
export function renderGuide() {
  const done = GUIDE.filter((_, i) => S.guide[i]).length;
  app.innerHTML = `
    <div style="max-width:860px;margin:0 auto">
      <h1>What to do next</h1>
      <p class="muted" style="font-size:1.05rem">A step-by-step plan for placing ${lovedOne()} in care. Check off steps as you go. Your progress is saved on this device.</p>
      <div class="progress" aria-label="${done} of ${GUIDE.length} steps done"><i style="width:${done / GUIDE.length * 100}%"></i></div>
      ${GUIDE.map((g, i) => `
        <div class="card guide-step ${S.guide[i] ? 'done' : ''}">
          <div class="num">${S.guide[i] ? '✓' : i + 1}</div>
          <div>
            <h3>${esc(g.t)}</h3><p style="margin-bottom:.4rem">${g.b.replace('{lo}', lovedOne())}</p>
            <details><summary>Show details</summary><ul>${g.more.map(m => `<li>${m}</li>`).join('')}</ul>
              ${g.checklist ? `<ul class="checklist">${TOUR_QS.map(q => `<li><label><input type="checkbox"> ${esc(q)}</label></li>`).join('')}</ul>` : ''}
            </details>
            <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
              <button class="btn small ${S.guide[i] ? 'secondary' : ''}" data-action="guide-toggle" data-i="${i}">${S.guide[i] ? 'Undo' : 'Mark done'}</button>
              ${g.link ? `<a class="btn small secondary" href="${g.link[0]}">${g.link[1]}</a>` : ''}
            </div>
          </div>
        </div>`).join('')}
      <h2 style="margin-top:2rem">Local help (free)</h2>
      <div class="help-grid">
        <div class="card"><h3>Aging Partners</h3><p class="small">Lincoln's Area Agency on Aging: care management, Medicaid help and caregiver support.</p><a href="tel:4024417070">402-441-7070</a></div>
        <div class="card"><h3>Alzheimer's Association</h3><p class="small">24/7 helpline with dementia care consultants, plus support groups in Lincoln.</p><a href="tel:18002723900">1-800-272-3900</a></div>
        <div class="card"><h3>Medicare Care Compare</h3><p class="small">Official ratings and inspection reports for every nursing home.</p><a href="https://www.medicare.gov/care-compare/" target="_blank" rel="noopener">medicare.gov/care-compare</a></div>
      </div>
    </div>`;
}

