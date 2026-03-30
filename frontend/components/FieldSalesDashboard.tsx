import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SummaryCard } from './SummaryCard';
import { Calendar, MapPin, DollarSign, TrendingUp, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Appointment {
  id: string;
  leadName: string;
  address: string;
  phone: string;
  date: string;
  time: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
}

interface Opportunity {
  id: string;
  leadName: string;
  address: string;
  phone: string;
  stage: 'Pitch Scheduled' | 'Pitch Completed' | 'Won' | 'Lost';
  value: number;
  product: 'Solar' | 'Battery' | 'EV Charger' | 'Bundle';
  lastActivity: string;
  notes?: string;
}

const mockAppointments: Appointment[] = [
  {
    id: '1',
    leadName: 'Sarah Johnson',
    address: '123 Oak Street, Austin, TX 78701',
    phone: '(555) 123-4567',
    date: '2024-10-05',
    time: '10:00 AM',
    status: 'Scheduled'
  },
  {
    id: '2',
    leadName: 'Mike Chen',
    address: '456 Pine Ave, Austin, TX 78702',
    phone: '(555) 234-5678',
    date: '2024-10-05',
    time: '2:00 PM',
    status: 'Scheduled'
  },
  {
    id: '3',
    leadName: 'Emily Davis',
    address: '789 Elm Drive, Austin, TX 78703',
    phone: '(555) 345-6789',
    date: '2024-10-06',
    time: '11:00 AM',
    status: 'Scheduled'
  }
];

const mockOpportunities: Opportunity[] = [
  {
    id: '1',
    leadName: 'Robert Wilson',
    address: '321 Maple St, Austin, TX',
    phone: '(555) 456-7890',
    stage: 'Pitch Scheduled',
    value: 25000,
    product: 'Solar',
    lastActivity: '2024-10-01'
  },
  {
    id: '2',
    leadName: 'Lisa Anderson',
    address: '654 Cedar Ln, Austin, TX',
    phone: '(555) 567-8901',
    stage: 'Pitch Completed',
    value: 35000,
    product: 'Bundle',
    lastActivity: '2024-10-02'
  },
  {
    id: '3',
    leadName: 'David Thompson',
    address: '987 Birch Way, Austin, TX',
    phone: '(555) 678-9012',
    stage: 'Won',
    value: 28000,
    product: 'Solar',
    lastActivity: '2024-09-30'
  }
];

export function FieldSalesDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(mockOpportunities);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Opportunity | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'No Show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Pitch Scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'Pitch Completed': return 'bg-blue-100 text-blue-800';
      case 'Won': return 'bg-green-100 text-green-800';
      case 'Lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDragStart = (opportunity: Opportunity) => {
    setDraggedItem(opportunity);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStage: Opportunity['stage']) => {
    e.preventDefault();
    if (draggedItem) {
      setOpportunities(prev => prev.map(opp => 
        opp.id === draggedItem.id ? { ...opp, stage: newStage } : opp
      ));
      setDraggedItem(null);
    }
  };

  const updateAppointmentStatus = (appointmentId: string, status: Appointment['status']) => {
    setAppointments(prev => prev.map(apt => 
      apt.id === appointmentId ? { ...apt, status } : apt
    ));
  };

  const stages: Opportunity['stage'][] = ['Pitch Scheduled', 'Pitch Completed', 'Won', 'Lost'];

  const totalPipelineValue = opportunities
    .filter(opp => opp.stage !== 'Lost')
    .reduce((sum, opp) => sum + opp.value, 0);

  const wonDeals = opportunities.filter(opp => opp.stage === 'Won');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Today's Appointments"
          value={appointments.filter(a => a.date === '2024-10-05').length}
          icon={Calendar}
          change="2 scheduled"
          changeType="positive"
        />
        <SummaryCard
          title="Pipeline Value"
          value={`$${(totalPipelineValue / 1000).toFixed(0)}k`}
          icon={DollarSign}
          change="+$15k this week"
          changeType="positive"
        />
        <SummaryCard
          title="Won This Month"
          value={wonDeals.length}
          icon={TrendingUp}
          change={`$${(wonDeals.reduce((sum, deal) => sum + deal.value, 0) / 1000).toFixed(0)}k value`}
          changeType="positive"
        />
        <SummaryCard
          title="Active Opportunities"
          value={opportunities.filter(o => o.stage !== 'Won' && o.stage !== 'Lost').length}
          icon={MapPin}
          change="3 need follow-up"
          changeType="neutral"
        />
      </div>

      <Tabs defaultValue="appointments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="pipeline">Opportunity Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>Appointment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{appointment.leadName}</h3>
                          <Badge className={getStatusColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {appointment.address}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {appointment.date} at {appointment.time}
                          </div>
                          <div>{appointment.phone}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {appointment.status === 'Scheduled' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ backgroundColor: 'var(--energy-green-1)', color: 'white', borderColor: 'var(--energy-green-1)' }}
                              onClick={() => updateAppointmentStatus(appointment.id, 'Completed')}
                            >
                              Mark Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus(appointment.id, 'Cancelled')}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {stages.map((stage) => (
                <Card key={stage} className="min-h-[400px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{stage}</CardTitle>
                    <p className="text-sm text-gray-600">
                      {opportunities.filter(opp => opp.stage === stage).length} opportunities
                    </p>
                  </CardHeader>
                  <CardContent 
                    className="space-y-3"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                  >
                    {opportunities
                      .filter(opp => opp.stage === stage)
                      .map((opportunity) => (
                        <div
                          key={opportunity.id}
                          draggable
                          onDragStart={() => handleDragStart(opportunity)}
                          className="p-3 border rounded-lg bg-white shadow-sm hover:shadow-md cursor-move transition-shadow"
                        >
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">{opportunity.leadName}</h4>
                            <div className="text-xs text-gray-600">
                              <div>{opportunity.address}</div>
                              <div>{opportunity.phone}</div>
                            </div>
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className="text-xs">
                                {opportunity.product}
                              </Badge>
                              <span className="font-semibold text-green-600">
                                ${(opportunity.value / 1000).toFixed(0)}k
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Last activity: {opportunity.lastActivity}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full text-xs"
                              onClick={() => {
                                setSelectedOpportunity(opportunity);
                                setShowNotesDialog(true);
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Note
                            </Button>
                          </div>
                        </div>
                    ))}
                    
                    {opportunities.filter(opp => opp.stage === stage).length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No opportunities in this stage
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note - {selectedOpportunity?.leadName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="noteType">Note Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select note type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="follow-up">Follow-up Required</SelectItem>
                  <SelectItem value="proposal">Proposal Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="noteContent">Note</Label>
              <Textarea 
                id="noteContent" 
                placeholder="Add details about your interaction..."
                defaultValue={selectedOpportunity?.notes}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
                Cancel
              </Button>
              <Button 
                style={{ backgroundColor: 'var(--energy-blue)', color: 'white' }}
                onClick={() => setShowNotesDialog(false)}
              >
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}