import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { SummaryCard } from "./SummaryCard";
import { Calendar, MapPin } from "lucide-react";

interface Appointment {
  id: string;
  leadName: string;
  address: string;
  phone: string;
  date: string;
  time: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "No Show";
}

const mockAppointments: Appointment[] = [
  {
    id: "1",
    leadName: "Sarah Johnson",
    address: "123 Oak Street, Austin, TX 78701",
    phone: "(555) 123-4567",
    date: "2024-10-05",
    time: "10:00 AM",
    status: "Scheduled",
  },
  {
    id: "2",
    leadName: "Mike Chen",
    address: "456 Pine Ave, Austin, TX 78702",
    phone: "(555) 234-5678",
    date: "2024-10-05",
    time: "2:00 PM",
    status: "Scheduled",
  },
  {
    id: "3",
    leadName: "Emily Davis",
    address: "789 Elm Drive, Austin, TX 78703",
    phone: "(555) 345-6789",
    date: "2024-10-06",
    time: "11:00 AM",
    status: "Scheduled",
  },
];

export function AppointmentsPage() {
  const [appointments, setAppointments] =
    useState<Appointment[]>(mockAppointments);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      case "No Show":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const updateStatus = (id: string, status: Appointment["status"]) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a)),
    );
  };

  const todayCount = appointments.filter((a) => a.date === "2024-10-05").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Today's Appointments"
          value={todayCount}
          icon={Calendar}
          change="2 scheduled"
          changeType="positive"
        />
        <SummaryCard
          title="This Week"
          value={appointments.length}
          icon={Calendar}
          change="3 total"
          changeType="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="border rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{apt.leadName}</h3>
                      <Badge className={getStatusColor(apt.status)}>
                        {apt.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {apt.address}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {apt.date} at {apt.time}
                      </div>
                      <div>{apt.phone}</div>
                    </div>
                  </div>
                  {apt.status === "Scheduled" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        style={{
                          backgroundColor: "var(--energy-green-1)",
                          color: "white",
                          borderColor: "var(--energy-green-1)",
                        }}
                        onClick={() => updateStatus(apt.id, "Completed")}
                      >
                        Mark Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(apt.id, "Cancelled")}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
