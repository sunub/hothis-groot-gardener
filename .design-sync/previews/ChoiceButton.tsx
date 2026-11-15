import { ChoiceButton } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[32rem] flex-col gap-1 bg-bg p-6 text-ink">{children}</div>
);

export const Options = () => (
  <Stage>
    <ChoiceButton keyLabel="A">Add water directly to the plant pillows</ChoiceButton>
    <ChoiceButton keyLabel="B">Turn the fan to high for the day</ChoiceButton>
    <ChoiceButton keyLabel="C">Wipe the leaves and wait</ChoiceButton>
  </Stage>
);

export const Selected = () => (
  <Stage>
    <ChoiceButton keyLabel="A" selected trailing="✓ Selected">Add water directly to the plant pillows</ChoiceButton>
    <ChoiceButton keyLabel="B">Turn the fan to high for the day</ChoiceButton>
  </Stage>
);

export const Confirmed = () => (
  <Stage>
    <ChoiceButton keyLabel="A" selected disabled trailing="✓ Selected">Add water directly to the plant pillows</ChoiceButton>
    <ChoiceButton keyLabel="B" dimmed disabled>Turn the fan to high for the day</ChoiceButton>
    <ChoiceButton keyLabel="C" dimmed disabled>Wipe the leaves and wait</ChoiceButton>
  </Stage>
);
