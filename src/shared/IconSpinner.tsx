import { FiLoader } from "react-icons/fi";
import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import "./IconSpinner.scss";

export default function IconSpinner({ children, className }: React.PropsWithChildren<{ className?: ClassNames }>) {
    className = classConcat(className, "icon-spinner");
    return <span className={className}><FiLoader className="prepend-inline-icon" />{children}</span>;
}
