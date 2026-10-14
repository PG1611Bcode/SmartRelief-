import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DashboardContent from '../components/DashboardContent';
import NeedsIntake from './dashboard/NeedsIntake';
import VolunteerIntake from './dashboard/VolunteerIntake';

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<DashboardContent />} />
          <Route path="needs-intake" element={<NeedsIntake />} />
          <Route path="volunteer-intake" element={<VolunteerIntake />} />
        </Routes>
      </main>
    </div>
  );
}
