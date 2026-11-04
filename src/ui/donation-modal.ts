import { App, Modal } from "obsidian";
import wechatImage from "../../assets/donation/wechat.png";
import alipayImage from "../../assets/donation/alipay.jpg";

export type DonationChannel = "wechat" | "alipay";

interface DonationChannelConfig {
  title: string;
  subtitle: string;
  image: string;
  alt: string;
}

const DONATION_CHANNELS: Record<DonationChannel, DonationChannelConfig> = {
  wechat: {
    title: "微信赞赏",
    subtitle: "请使用微信扫描下方二维码",
    image: wechatImage,
    alt: "ZENdian 微信赞赏码",
  },
  alipay: {
    title: "支付宝赞赏",
    subtitle: "请使用支付宝扫描下方二维码",
    image: alipayImage,
    alt: "ZENdian 支付宝赞赏码",
  },
};

export class DonationModal extends Modal {
  constructor(app: App, private readonly channel: DonationChannel) {
    super(app);
  }

  onOpen(): void {
    const config = DONATION_CHANNELS[this.channel];
    this.modalEl.addClass("zendian-donation-modal", "zendian-shared-modal");
    this.titleEl.setText(config.title);

    const view = this.contentEl.createDiv("zendian-donation-view");
    view.createEl("p", {
      cls: "zendian-donation-subtitle",
      text: config.subtitle,
    });

    const frame = view.createDiv("zendian-donation-image-frame");
    const image = frame.createEl("img", {
      cls: "zendian-donation-image",
      attr: {
        src: config.image,
        alt: config.alt,
        loading: "eager",
        decoding: "async",
      },
    });
    image.draggable = false;

    view.createEl("p", {
      cls: "zendian-donation-footnote",
      text: "赞赏完全自愿，不影响任何功能、更新或技术支持。付款前请核对收款信息。",
    });
  }

  onClose(): void {
    this.modalEl.removeClass("zendian-donation-modal", "zendian-shared-modal");
    this.contentEl.empty();
  }
}
