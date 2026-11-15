import type { Dictionary } from '../types';

/** 모든 화면에서 같이 쓰는 말. 같은 것은 어디서나 같은 낱말로 부릅니다. */
export const common: Dictionary['common'] = {
  app_name: '우주 정원 시뮬레이터',
  crop_name: "'Outredgeous' 붉은 로메인 상추",
  metric: {
    plant_health: '식물 건강',
    root_moisture: '뿌리 수분',
    humidity: '재배실 습도',
    fan: '환기 팬',
    light: '조명',
  },
  zone: {
    danger_low: '위험(낮음)',
    caution_low: '주의(낮음)',
    normal: '정상',
    caution_high: '주의(높음)',
    danger_high: '위험(높음)',
  },
  fan_level: { low: '약', high: '강' },
  light_level: { low: '약', medium: '중', high: '강' },
  growth_stage: {
    germination: '발아',
    growth: '생장',
    pre_harvest: '수확 전',
    harvest: '수확',
  },
  verdict: {
    appropriate: '적절',
    partial: '부분 적절',
    inappropriate: '부적절',
  },
  value_type: {
    measured: '기록값',
    game_value: '게임 값',
  },
  overnight_change: '밤사이 예상에 없던 변화: {metric} {from} → {to}.',
  value_type_help: {
    measured: '인용한 출처에서 가져온 값입니다.',
    game_value: '게임 균형을 위해 팀이 정한 값입니다. NASA의 값이 아닙니다.',
  },
  source: {
    label: '출처',
    quote_label: '출처 문장',
    none: '기록된 출처가 없습니다. 이 선택지는 게임을 위해서만 있습니다.',
  },
  disclaimer: {
    simulation:
      '이것은 훈련용 시뮬레이션입니다. 식물 상태 수치와 그 변화는 측정값이 아니라 게임 값입니다.',
    not_diagnostic:
      '이 도구는 식물이나 사람을 진단하지 않으며, 사람의 건강 정보를 기록하지 않습니다.',
  },
  nav: { label: '주 메뉴', home: '처음으로', sources: '근거와 출처' },
  language: { label: '언어', en: 'English', ko: '한국어' },
  day_label: '일차',
  cultivation_day_label: '재배일',
};
