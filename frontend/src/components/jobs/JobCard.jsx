import { motion } from 'framer-motion';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { HiOutlineMapPin, HiOutlineBriefcase } from 'react-icons/hi2';

export default function JobCard({ job, index = 0, onApply }) {
  return (
    <motion.div
      className="glass-card job-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="job-title">{job.title}</div>
      <div className="job-company">{job.company || 'Company not specified'}</div>
      <p className="job-desc">{job.description || 'No description available'}</p>
      <div className="job-meta">
        {job.location && (
          <Badge variant="info">
            <HiOutlineMapPin size={12} /> {job.location}
          </Badge>
        )}
        <Badge variant="primary">
          <HiOutlineBriefcase size={12} /> {job.job_type || 'Full-time'}
        </Badge>
      </div>
      <div style={{ marginTop: '16px' }}>
        <Button variant="primary" size="sm" onClick={() => onApply?.(job.id)} id={`apply-job-${job.id}`}>
          Apply Now
        </Button>
      </div>
    </motion.div>
  );
}
