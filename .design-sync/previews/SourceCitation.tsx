import { SourceCitation } from 'space-garden-ui';

export const WithSource = () => (
  <div className="w-[34rem] bg-bg p-6 text-ink">
    <SourceCitation
      source={{
        title: 'Plant growth in the Veggie unit on the ISS',
        url: 'https://ntrs.nasa.gov/citations/example',
        quote: 'Leaf tip burn appeared when humidity stayed high.',
        license: 'Public domain',
        note: 'Quote copied verbatim from the report.',
      }}
    />
  </div>
);

export const NoSource = () => (
  <div className="w-[34rem] bg-bg p-6 text-ink">
    <SourceCitation source={null} />
  </div>
);
