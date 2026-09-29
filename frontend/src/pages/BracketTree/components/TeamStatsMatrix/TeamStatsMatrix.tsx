import { Card } from '../../../../components/Card';
import styles from './TeamStatsMatrix.module.css';

export interface TeamStatsRow {
  id: string;
  seed: number;
  teamName: string;
  values: string[];
  status: string;
}

interface TeamStatsMatrixProps {
  title: string;
  meta: string;
  columns: string[];
  rows: TeamStatsRow[];
  footnote: string;
}

export function TeamStatsMatrix({ title, meta, columns, rows, footnote }: TeamStatsMatrixProps) {
  return (
    <Card className={styles.card}>
      <header className={styles.heading}>
        <h2>{title}</h2>
        <span>{meta}</span>
      </header>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              {columns.slice(1).map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span>#{row.seed}</span> {row.teamName}
                </th>
                {row.values.map((value, index) => (
                  <td key={`${row.id}-${index}`}>{value}</td>
                ))}
                <td className={styles.status}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>{footnote}</p>
    </Card>
  );
}
