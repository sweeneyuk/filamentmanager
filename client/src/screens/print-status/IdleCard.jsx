import Card from '../../ui/Card';
import Readings from './Readings';

export default function IdleCard({ state, phase }) {
  return (
    <Card className="ps-idle" aria-label="Printer state">
      <div className="ps-idle__head">
        <div>
          <div className="ps-idle__label">{phase.id === 'other' ? 'Status' : 'Last print'}</div>
          <div className="ps-idle__name">{phase.id === 'other' ? phase.label : state.name || 'No print yet'}</div>
        </div>
        {state.stage && !['Idle', phase.label].includes(state.stage) && <div className="ps-idle__stage">{state.stage}</div>}
      </div>
      <Readings state={state} />
    </Card>
  );
}
