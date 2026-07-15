import { DetailHeader } from '../shared/DetailHeader';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import type { ISequence } from '~/shared/types/db';

interface SequenceDetailProps {
  sequence: ISequence;
}

export function SequenceDetail({ sequence }: SequenceDetailProps) {
  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="sequence" name={sequence.name} />
      <div className="flex-1 overflow-auto">
        <KeyValueGrid
          items={[
            { key: 'Current Value', value: sequence.currentValue?.toString() ?? '-' },
            { key: 'Start Value', value: sequence.startValue.toString() },
            { key: 'Increment', value: sequence.increment.toString() },
            { key: 'Min Value', value: sequence.minValue?.toString() ?? '-' },
            { key: 'Max Value', value: sequence.maxValue?.toString() ?? '-' },
            { key: 'Cycle', value: sequence.isCyclic ? 'Yes' : 'No' },
            { key: 'Data Type', value: sequence.dataType },
          ]}
        />
      </div>
    </div>
  );
}
