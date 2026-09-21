import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { IconAlert } from "./Icons";
import i18n from "../lib/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort safety net. Crashes that would previously render a blank page
 * now show a visible fallback with a working "reload" escape hatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-[60vh] place-items-center px-4 py-16" role="alert">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-clay-500/10 text-clay-500">
            <IconAlert className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-5 text-xl font-semibold text-pine-900">
            {i18n.t("errors.boundaryTitle")}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-sage">
            {i18n.t("errors.boundaryMsg")}
          </p>
          <p className="tnum mt-3 rounded-xl bg-paper px-3 py-2 text-[12px] text-sage">
            {this.state.error.message}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={this.reload}
              className="rounded-full bg-gradient-to-br from-pine-700 to-leaf-600 px-5 py-2.5 text-sm font-semibold text-paper shadow-card transition-transform duration-200 hover:-translate-y-0.5"
            >
              {i18n.t("errors.reload")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}