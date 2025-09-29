export interface FlowerVariable {
  name: string;
  placeholder: string;
  defaultValue: string;
}

export interface FlowerTemplate {
  id: string;
  name: string;
  description: string;
  variables: FlowerVariable[];
  promptTemplate: string;
}

export const FLOWER_TEMPLATES: FlowerTemplate[] = [
  {
    id: "single-branch",
    name: "Gen nhánh hoa",
    description: "Tạo hình ảnh nhánh hoa đơn với một bông hoa nở",
    variables: [
      {
        name: "flower_name",
        placeholder: "Tên loài hoa (ví dụ: Yellow Lily)",
        defaultValue: "Yellow Lily"
      },
      {
        name: "petal_color",
        placeholder: "Màu cánh hoa (ví dụ: golden yellow)",
        defaultValue: "golden yellow"
      },
      {
        name: "anther_color",
        placeholder: "Màu nhị hoa (ví dụ: warm brown)",
        defaultValue: "warm brown"
      },
      {
        name: "filament_color",
        placeholder: "Màu chỉ nhị (ví dụ: pale yellow)",
        defaultValue: "pale yellow"
      }
    ],
    promptTemplate: `SUBJECT: single [{{flower_name}}] branch; stem have 2 leaves and one bloom flower 
STYLE: semi-realistic; product illustration; clean, perfect surfaces.
COLOR: petals [{{petal_color}}]; leaves fresh green; anthers [{{anther_color}}]; filaments [{{filament_color}}]; saturation even.
FORM: lifelike shape; soft curved tepals; clear layering; visible stamen/pistil; slender lanceolate leaves; visible stem nodes.
SURFACE/TEXTURE: smooth; even color; pristine; no wrinkles/spots/dust/blemishes/wilt.
LIGHTING: neutral studio; softbox key and gentle fill; soft, diffused shadow; no color cast.
CAMERA: minimal perspective; slight 3/4 angle.
COMPOSITION: centered; ample breathing room; clear silhouette; clean edges; easy cutout.
FINISH: smooth highlights; subtle micro-specular; not plastic; not painterly; no grain.
NEGATIVE: imperfections; wilted/torn; insect damage; water droplets; vase/props; colored/gradient bg; harsh/deep shadows; crushed blacks; chromatic aberration; vignette; noise; oversaturation; oversharpening; text/watermark/logo/frame; blur/motion blur; cartoon/toy look.`
  },
  {
    id: "bouquet",
    name: "Gen bó hoa",
    description: "Tạo hình ảnh bó hoa với nhiều bông hoa nở",
    variables: [
      {
        name: "flower_name",
        placeholder: "Tên loài hoa (ví dụ: Yellow Lily)",
        defaultValue: "Yellow Lily"
      },
      {
        name: "petal_color",
        placeholder: "Màu cánh hoa (ví dụ: golden yellow)",
        defaultValue: "golden yellow"
      },
      {
        name: "anther_color",
        placeholder: "Màu nhị hoa (ví dụ: warm brown)",
        defaultValue: "warm brown"
      },
      {
        name: "filament_color",
        placeholder: "Màu chỉ nhị (ví dụ: pale yellow)",
        defaultValue: "pale yellow"
      }
    ],
    promptTemplate: `SUBJECT: bouquet of [{{flower_name}}] stems; 7–9 open blooms with a few buds; multiple stems with leaves.
STYLE: semi-realistic; product illustration; clean, perfect surfaces.
COLOR: petals [{{petal_color}}]; leaves fresh green; anthers [{{anther_color}}]; filaments [{{filament_color}}]; saturation even.
FORM: lifelike shape; petals show gentle thickness and depth; soft curved tepals; clear layering; visible stamen/pistil; slender lanceolate leaves; mix of front and slight 3/4 bloom angles; natural size variation across flowers.
SURFACE/TEXTURE: smooth; even color; pristine; minimal vein details on petals and leaves (subtle, softened); no wrinkles/spots/dust/blemishes/wilt.
LIGHTING: neutral studio; softbox key and gentle fill; soft, diffused shadow; no color cast.
CAMERA: minimal perspective; product-macro feel; slight 3/4 overall.
COMPOSITION: centered bouquet; fan/triangular silhouette; ample breathing room; clear overlapping hierarchy; clean edges; easy cutout.
FINISH: smooth highlights; subtle micro-specular; not plastic; not painterly; no grain.
NEGATIVE: imperfections; wilted/torn; insect damage; water droplets; ribbon/tie; vase/props; colored/gradient bg; harsh/deep shadows; crushed blacks; chromatic aberration; vignette; noise; oversaturation; oversharpening; text/watermark/logo/frame; blur/motion blur; cartoon/toy look.`
  }
];

export function processTemplate(template: FlowerTemplate, variables: Record<string, string>): string {
  let processedPrompt = template.promptTemplate;
  
  template.variables.forEach(variable => {
    const value = variables[variable.name] || variable.defaultValue;
    const placeholder = `{{${variable.name}}}`;
    processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return processedPrompt;
}
