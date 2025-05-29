"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface CronJob {
  name: string;
  path: string;
  schedule: string;
  description: string;
  lastRun?: string;
  status?: "success" | "failed" | "running";
}

const cronJobs: CronJob[] = [
  {
    name: "Memory Refresh",
    path: "/api/cron/ai/memory",
    schedule: "0 3 * * *",
    description: "Daily refresh of assistant settings based on saved memories (3 AM UTC)"
  },
  {
    name: "Memory Decay",
    path: "/api/cron/ai/memory/decay",
    schedule: "0 2 * * *",
    description: "Daily decay of old memories to manage storage (2 AM UTC)"
  },
  {
    name: "Semantic Extraction",
    path: "/api/cron/ai/semantic-extraction",
    schedule: "0 4 * * 0",
    description: "Weekly extraction of semantic memories from episodic memories (4 AM UTC on Sundays)"
  }
];

function parseCronSchedule(schedule: string): string {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  let desc = "";
  
  // Time
  desc += `at ${hour}:${minute.padStart(2, '0')} UTC`;
  
  // Frequency
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    desc = `Daily ${desc}`;
  } else if (dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    desc = `Weekly on ${days[parseInt(dayOfWeek)]} ${desc}`;
  } else if (dayOfMonth !== '*') {
    desc = `Monthly on day ${dayOfMonth} ${desc}`;
  }
  
  return desc;
}

export default function CronDashboard() {
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [jobResults, setJobResults] = useState<Record<string, { status: "success" | "failed"; message: string }>>({});

  const triggerCronJob = async (job: CronJob) => {
    setRunningJobs(prev => new Set(prev).add(job.path));
    setJobResults(prev => ({ ...prev, [job.path]: { status: "success", message: "Running..." } }));
    
    try {
      const response = await fetch("/api/cron/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: job.path }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger cron job");
      }
      
      setJobResults(prev => ({
        ...prev,
        [job.path]: { status: "success", message: data.message || "Job completed successfully" }
      }));
    } catch (error) {
      setJobResults(prev => ({
        ...prev,
        [job.path]: { status: "failed", message: error instanceof Error ? error.message : "Unknown error" }
      }));
    } finally {
      setRunningJobs(prev => {
        const next = new Set(prev);
        next.delete(job.path);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Cron Job Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage and manually trigger scheduled tasks
        </p>
      </div>

      <div className="grid gap-4">
        {cronJobs.map((job) => (
          <Card key={job.path}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{job.name}</CardTitle>
                  <CardDescription className="mt-1">{job.description}</CardDescription>
                </div>
                <Badge variant="outline" className="ml-4">
                  {parseCronSchedule(job.schedule)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Path: <code className="bg-muted px-1 py-0.5 rounded">{job.path}</code>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Schedule: <code className="bg-muted px-1 py-0.5 rounded">{job.schedule}</code>
                  </p>
                  {jobResults[job.path] && (
                    <p className={`text-sm mt-2 ${jobResults[job.path].status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {jobResults[job.path].message}
                    </p>
                  )}
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="default"
                      disabled={runningJobs.has(job.path)}
                    >
                      {runningJobs.has(job.path) ? "Running..." : "Trigger Manually"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Trigger {job.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will manually run the cron job immediately. The job may take several minutes to complete depending on the amount of data to process.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => triggerCronJob(job)}>
                        Trigger Job
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Cron Schedule Reference</CardTitle>
          <CardDescription>Understanding cron expressions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><code className="bg-muted px-1 py-0.5 rounded">* * * * *</code> - Every minute</p>
            <p><code className="bg-muted px-1 py-0.5 rounded">0 * * * *</code> - Every hour</p>
            <p><code className="bg-muted px-1 py-0.5 rounded">0 3 * * *</code> - Daily at 3 AM</p>
            <p><code className="bg-muted px-1 py-0.5 rounded">0 4 * * 0</code> - Weekly on Sunday at 4 AM</p>
            <p><code className="bg-muted px-1 py-0.5 rounded">0 0 1 * *</code> - Monthly on the 1st at midnight</p>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Format: <code className="bg-muted px-1 py-0.5 rounded">minute hour day month day-of-week</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}