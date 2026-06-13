import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { priorities } from '@/config/selection';
import { CasePriorityCountType } from '@/types/chart';
import { PriorityMessages } from '@/types/priority';
import { ChartDataType } from '@/types/chart';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Props = {
  priorityCounts: CasePriorityCountType[];
  priorityMessages: PriorityMessages;
  theme: string | undefined;
};

export default function TestPriorityDonutChart({ priorityCounts, priorityMessages, theme }: Props) {
  const [chartData, setChartData] = useState<ChartDataType>({
    series: [],
    options: {
      labels: [],
      colors: [],
    },
  });

  useEffect(() => {
    const updateChartDate = () => {
      if (priorityCounts) {
        const series = priorities.map((entry, index) => {
          const found = priorityCounts.find((itr) => itr.priority === index);
          return found ? found.count : 0;
        });

        const labels = priorities.map((entry) => priorityMessages[entry.uid]);
        const colors = priorities.map((entry) => entry.chartColor);
        const labelColor = theme === 'dark' ? '#d4d4d4' : '#525252';
        const legend = {
          labels: {
            colors: priorities.map(() => labelColor),
          },
          position: 'bottom' as const,
          itemMargin: {
            horizontal: 8,
            vertical: 4,
          },
        };

        setChartData({
          series,
          options: {
            chart: {
              parentHeightOffset: 0,
            },
            dataLabels: {
              enabled: false,
            },
            labels,
            colors,
            legend,
            stroke: {
              width: 0,
            },
            plotOptions: {
              pie: {
                donut: {
                  size: '68%',
                },
              },
            },
          },
        });
      }
    };

    updateChartDate();
  }, [priorityCounts, priorityMessages, theme]);

  return <Chart options={chartData.options} series={chartData.series} type="donut" width={'100%'} height={'100%'} />;
}
