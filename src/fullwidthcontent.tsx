// Breaks out of the app-wide "body { max-width: 38rem }" constraint (see index.css) to span the
// full viewport width, using viewport units instead of the parent's constrained width so it works
// regardless of that ancestor's max-width. px-8 keeps a margin from the actual screen edges.
const FullWidthContent: React.FunctionComponent<{children: React.ReactNode}> = (props) => {
    return (
        <div className="w-screen ml-[calc(50%-50vw)] px-8">{props.children}</div>
    );
};
export default FullWidthContent;
