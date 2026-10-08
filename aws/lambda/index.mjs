// AWS Lambda (Function URL): attendance report, invoked by the FaaS engine on the Raft nodes.
export const handler = async (event, context) => {
  const { records = [] } = JSON.parse(event.body || '{}');
  const byDate = {};
  for (const r of records) {
    byDate[r.date] = byDate[r.date] || { date: r.date, present: 0, absent: 0 };
    if (r.present) byDate[r.date].present++; else byDate[r.date].absent++;
  }
  const data = Object.values(byDate).map(d => ({ ...d, total: d.present + d.absent, percentage: Math.round(d.present / (d.present + d.absent) * 100) }));
  return {
    type: 'attendance-report',
    executedOn: 'AWS Lambda',
    region: process.env.AWS_REGION,
    requestId: context.awsRequestId,
    generatedAt: new Date().toISOString(),
    data
  };
};
