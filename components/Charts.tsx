import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';

interface ChartProps {
  data: any[];
  colors: string[];
  currency: string;
  isDark: boolean;
  customKeys?: string[];
  onClick?: (data: any) => void;
}

interface OverviewChartProps extends ChartProps {
  remaining: number;
  totalIncome: number;
  t: (key: string) => string;
}

const ChartTooltip = ({ active, payload, label, currency, isDark }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`p-2.5 rounded-xl shadow-2xl border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-100 text-gray-900'} animate-in zoom-in duration-200 z-50`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{data.name || label}</p>
          <div className="space-y-1">
             {payload.map((entry: any, index: number) => (
                <p key={index} className="text-[11px] font-bold flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                   {entry.name}: <span className="font-mono">{currency} {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </p>
             ))}
          </div>
        </div>
      );
    }
    return null;
};

export const FinancialOverviewChart: React.FC<OverviewChartProps> = ({ data, colors, currency, isDark, remaining, totalIncome, t, onClick }) => {
  const chartData = [...data];
  
  if (remaining > 0) {
    chartData.push({
      name: t('reminding'),
      value: remaining,
      isSpecial: true,
      color: '#32d74b' 
    });
  } else if (remaining < 0) {
    chartData.push({
      name: t('extraExpense'),
      value: Math.abs(remaining),
      isSpecial: true,
      color: '#ff3b30' 
    });
  }

  return (
    <div className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%" 
            innerRadius="40%" 
            outerRadius="90%" 
            paddingAngle={2} 
            dataKey="value"
            stroke={isDark ? "#1f2937" : "#ffffff"} 
            strokeWidth={2}
            animationBegin={0}
            animationDuration={800}
            label={false}
            onClick={(data) => onClick && onClick(data)}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.isSpecial ? entry.color : colors[index % colors.length]}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            ))}
          </Pie>
          <RechartsTooltip content={<ChartTooltip currency={currency} isDark={isDark} />} />
          <Legend 
              verticalAlign="bottom" 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ 
                  fontSize: '8px', 
                  fontWeight: '900', 
                  textTransform: 'uppercase',
                  paddingTop: '10px',
                  position: 'relative'
              }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const FlowBarChart: React.FC<ChartProps> = ({ data, currency, isDark, onClick }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  onClick && onClick(e.activePayload[0].payload);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis 
                    dataKey="date" 
                    tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 'bold'}} 
                    tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getDate()}/${d.getMonth()+1}`;
                    }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                     cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                     contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: 'transparent', borderRadius: '12px' }}
                     itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}
                     content={<ChartTooltip currency={currency} isDark={isDark} />}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}/>
                <Bar dataKey="income" name="Income" fill="#32d74b" radius={[6, 6, 0, 0]} maxBarSize={30} />
                <Bar dataKey="expense" name="Expense" fill="#ff3b30" radius={[6, 6, 0, 0]} maxBarSize={30} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export const TrendLineChart: React.FC<ChartProps> = ({ data, currency, isDark, customKeys, onClick }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }} onClick={(e) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  onClick && onClick(e.activePayload[0].payload);
                }
              }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis 
                    dataKey="month" 
                    tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 'bold'}} 
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                     contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: 'transparent', borderRadius: '12px' }}
                     content={<ChartTooltip currency={currency} isDark={isDark} />}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '10px', fontWeight: 'black', textTransform: 'uppercase' }}/>
                {customKeys ? (
                  customKeys.map((key, i) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={['#ff3b30', '#0072d6', '#ff9500', '#75d9ff'][i % 4]} strokeWidth={3} dot={{r: 3}} activeDot={{r: 6}} />
                  ))
                ) : (
                  <>
                    <Line type="monotone" dataKey="income" stroke="#32d74b" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="expense" stroke="#ff3b30" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                  </>
                )}
            </LineChart>
        </ResponsiveContainer>
    );
};

export const SpendingHeatmap: React.FC<{ transactions: any[], currency: string, isDark: boolean, onClick: (date: string) => void }> = ({ transactions, currency, isDark, onClick }) => {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const date = t.date.split('T')[0];
      map[date] = (map[date] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  const vals = Object.values(data) as number[];
  const maxSpend = Math.max(...vals, 1);
  
  // Generate calendar days for current view
  const days = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Sort transactions to find range
    const sorted = [...transactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const start = new Date(sorted[0].date);
    const end = new Date(sorted[sorted.length-1].date);
    
    // Normalize to start of month of first transaction and end of month of last
    const calendarStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const calendarEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0); // Last day of month

    const dayList = [];
    const curr = new Date(calendarStart);
    while (curr <= calendarEnd) {
      dayList.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dayList;
  }, [transactions]);

  const getColor = (amount: number) => {
    if (!amount) return isDark ? 'bg-gray-800' : 'bg-gray-100';
    const intensity = amount / maxSpend;
    if (intensity < 0.2) return 'bg-red-200 dark:bg-red-900/40';
    if (intensity < 0.5) return 'bg-red-400 dark:bg-red-700/60';
    if (intensity < 0.8) return 'bg-red-500 dark:bg-red-600';
    return 'bg-red-600 dark:bg-red-500';
  };

  if (days.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-xs font-bold uppercase">No data to map</div>;

  return (
    <div className="h-full overflow-y-auto pr-1 no-scrollbar">
      <div className="grid grid-cols-7 gap-1.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-black text-gray-400 uppercase">{d}</div>
        ))}
        {/* Padding for first day */}
        {Array.from({ length: days[0].getDay() }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map(d => {
          const dateStr = d.toISOString().split('T')[0];
          const amount = data[dateStr] || 0;
          return (
            <div 
              key={dateStr}
              onClick={() => onClick(dateStr)}
              className={`aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative group ${getColor(amount)}`}
            >
              <span className={`text-[9px] font-bold ${amount > 0 ? 'text-white' : 'text-gray-400 dark:text-gray-700'}`}>
                {d.getDate()}
              </span>
              {amount > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                  {currency}{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};