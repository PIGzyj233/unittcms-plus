import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ProgressSeriesType } from '@/types/run';
import { testRunCaseStatus } from '@/config/selection';
import { ChartDataType } from '@/types/chart';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Props = {
  progressSeries: ProgressSeriesType[];
  progressCategories: string[];
  theme: string | undefined;
};

export default function TestProgressBarChart({ progressSeries, progressCategories, theme }: Props) {
  const [chartData, setChartData] = useState<ChartDataType>({
    series: [],
    options: {
      labels: [],
      colors: [],
    },
  });

  useEffect(() => {
    const updateChartDate = () => {
      if (progressSeries) {
        const labelColor = theme === 'dark' ? '#d4d4d4' : '#525252';
        const gridColor = theme === 'dark' ? '#262626' : '#e5e5e5';
        const tooltipTheme = theme === 'light' || theme === 'dark' ? theme : undefined;

        setChartData({
          series: progressSeries,
          options: {
            chart: {
              animations: {
                enabled: true,
                speed: 350,
              },
              parentHeightOffset: 0,
              toolbar: {
                show: false,
              },
              stacked: true,
            },
            dataLabels: {
              enabled: false,
            },
            grid: {
              borderColor: gridColor,
              strokeDashArray: 3,
            },
            legend: {
              horizontalAlign: 'left',
              itemMargin: {
                horizontal: 10,
                vertical: 4,
              },
              labels: {
                colors: testRunCaseStatus.map(() => labelColor),
              },
              position: 'top',
            },
            colors: testRunCaseStatus.map((itr) => {
              return itr.chartColor;
            }),
            xaxis: {
              type: 'datetime',
              categories: progressCategories,
              labels: {
                style: {
                  colors: labelColor,
                },
              },
            },
            yaxis: {
              labels: {
                style: {
                  colors: labelColor,
                },
              },
            },
            tooltip: {
              theme: tooltipTheme,
            },
          },
        });
      }
    };

    updateChartDate();
  }, [progressSeries, progressCategories, theme]);

  return <Chart options={chartData.options} series={chartData.series} type="bar" width={'100%'} height={'100%'} />;
}
