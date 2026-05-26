import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { HiOutlineMapPin, HiOutlineBriefcase, HiOutlineCalendar } from 'react-icons/hi2';

export default function JobDetail({ job, onApply, hasApplied }) {
  if (!job) return null;

  return (
    <div>
      <div className="glass-card-static" style={{ padding: '32px', marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>{job.title}</h1>
        <div style={{ color: 'var(--primary-400)', fontWeight: 500, fontSize: '1.1rem', marginBottom: '16px' }}>
          {job.company || 'Company'}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {job.location && <Badge variant="info"><HiOutlineMapPin size={12} /> {job.location}</Badge>}
          <Badge variant="primary"><HiOutlineBriefcase size={12} /> {job.job_type || 'Full-time'}</Badge>
          <Badge variant="warning"><HiOutlineCalendar size={12} /> {new Date(job.created_at).toLocaleDateString()}</Badge>
        </div>

        {!hasApplied ? (
          <Button variant="primary" size="lg" onClick={onApply} id="apply-job-btn">Apply Now</Button>
        ) : (
          <Badge variant="success" style={{ padding: '10px 16px', fontSize: '0.9rem' }}>✓ Application Submitted</Badge>
        )}
      </div>

      {job.description && (
        <div className="glass-card-static" style={{ padding: '24px' }}>
          <h4 style={{ marginBottom: '12px' }}>Job Description</h4>
          <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {job.description}
          </div>
        </div>
      )}
    </div>
  );
}
